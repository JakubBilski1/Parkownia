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
