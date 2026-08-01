import { MockPaymentProvider } from "./mock";
import type { PaymentProvider } from "./provider";
import { StripePaymentProvider } from "./stripe";

let cached: PaymentProvider | null = null;

/**
 * `mock` is the default and `stripe` is opt-in, on purpose: nobody should be one
 * forgotten env var away from charging a real card from a laptop. The choice is
 * made once, in .env, and the rest of the codebase never asks who the PSP is.
 *
 * Lives apart from index.ts so that bookings/cancel.ts can reach the provider
 * without importing the payments barrel — which imports bookings back.
 */
export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;

  const configured = (process.env.PAYMENT_PROVIDER ?? "mock").toLowerCase();
  cached = configured === "stripe" ? new StripePaymentProvider() : new MockPaymentProvider();
  return cached;
}

/** Webhook routing: /api/webhooks/{slug}. Only the configured provider answers. */
export function getProviderBySlug(slug: string): PaymentProvider | null {
  const provider = getPaymentProvider();
  return provider.slug === slug.toLowerCase() ? provider : null;
}

/**
 * Whether a booking made right now could ever be paid for.
 *
 * The mock provider refuses to verify a webhook in production on purpose (see
 * mock.ts — wiring it live would let anyone POST themselves a paid booking).
 * Production with no PAYMENT_PROVIDER therefore accepts a booking, takes the
 * driver's e-mail and phone, creates an intent, and then leaves them on a
 * spinner that never resolves. That is worse than not selling: it is a form that
 * eats data and gives nothing back.
 *
 * So the same condition that makes payment impossible is the one that closes the
 * shop, rather than a separate flag somebody has to remember to flip. Turning
 * sales on IS configuring a real PSP.
 */
export function canAcceptPayments(): boolean {
  // Reads the environment rather than calling getPaymentProvider(): constructing
  // the Stripe provider throws when STRIPE_SECRET_KEY is missing, and this is
  // asked during page render. A question about whether the shop is open must
  // never be able to answer with a 500.
  const configured = (process.env.PAYMENT_PROVIDER ?? "mock").toLowerCase();

  if (configured === "stripe") {
    // A named PSP with no key is not an open shop, it is a crash waiting at
    // checkout. Closed is the honest answer.
    return Boolean(process.env.STRIPE_SECRET_KEY);
  }

  return process.env.NODE_ENV !== "production";
}
