import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The switch that decides whether the shop is open, and it is worth a test
 * because production already shipped the wrong side of it.
 *
 * With no PAYMENT_PROVIDER set, production defaulted to the mock — which refuses
 * to verify a webhook in production on purpose (mock.ts: wiring it live would
 * let anyone POST themselves a paid booking). So the checkout accepted a
 * booking, took the driver's e-mail and phone, created an intent, and left them
 * on "Czekamy na płatność" forever. Every local check was green: nothing in the
 * suite asked whether a booking could actually be paid for.
 *
 * The module caches its provider, so each case gets a fresh import.
 */
async function loadCanAcceptPayments() {
  vi.resetModules();
  const factory = await import("@/modules/payments/factory");
  return factory.canAcceptPayments;
}

const ORIGINAL = {
  provider: process.env.PAYMENT_PROVIDER,
  nodeEnv: process.env.NODE_ENV,
  stripeKey: process.env.STRIPE_SECRET_KEY,
};

function setEnv(provider: string | undefined, nodeEnv: string, stripeKey?: string) {
  if (provider === undefined) delete process.env.PAYMENT_PROVIDER;
  else process.env.PAYMENT_PROVIDER = provider;
  if (stripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = stripeKey;
  // NODE_ENV is readonly in the Node types but writable at runtime, and the
  // whole point here is to reproduce the production branch.
  (process.env as Record<string, string>).NODE_ENV = nodeEnv;
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  setEnv(ORIGINAL.provider, ORIGINAL.nodeEnv ?? "test", ORIGINAL.stripeKey);
  vi.resetModules();
});

describe("canAcceptPayments", () => {
  it("is false in production with no PSP configured — the state that shipped", async () => {
    setEnv(undefined, "production");
    const canAcceptPayments = await loadCanAcceptPayments();
    expect(canAcceptPayments()).toBe(false);
  });

  it("is false in production when the mock is named explicitly", async () => {
    setEnv("mock", "production");
    const canAcceptPayments = await loadCanAcceptPayments();
    expect(canAcceptPayments()).toBe(false);
  });

  it("is true with the mock outside production, so local development still sells", async () => {
    setEnv("mock", "development");
    const canAcceptPayments = await loadCanAcceptPayments();
    expect(canAcceptPayments()).toBe(true);
  });

  it("is true in production once a real PSP is configured", async () => {
    setEnv("stripe", "production", "sk_test_not_a_real_key");
    const canAcceptPayments = await loadCanAcceptPayments();
    expect(canAcceptPayments()).toBe(true);
  });

  /**
   * Found by writing this test. The first version asked getPaymentProvider(),
   * whose Stripe constructor throws without STRIPE_SECRET_KEY — so a half-done
   * configuration turned "is the shop open?" into a 500 on the map page and at
   * checkout, instead of a closed shop.
   */
  it("is false — not a crash — when stripe is named but has no key", async () => {
    setEnv("stripe", "production", undefined);
    const canAcceptPayments = await loadCanAcceptPayments();
    expect(() => canAcceptPayments()).not.toThrow();
    expect(canAcceptPayments()).toBe(false);
  });
});
