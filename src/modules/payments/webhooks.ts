import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { webhookEvents } from "@/db/schema";
import { getProviderBySlug } from "./factory";
import { applyAccountUpdate } from "./onboarding";
import { WebhookSignatureError, type NormalizedEvent, type PaymentProvider } from "./provider";
import { applyRefundEvent, applySucceededPayment, markPaymentFailed } from "./service";

export type WebhookOutcome = {
  status: number;
  body: { received: boolean; duplicate?: boolean; outcome?: string; error?: string };
};

/**
 * Order is the contract (docs/PAYMENTS.md §3.1):
 *
 *   1. verify the signature — before parsing, before the database
 *   2. claim the event id — INSERT ... ON CONFLICT DO NOTHING
 *   3. act — compare the amount, confirm under lock
 *   4. stamp processed_at
 *
 * Step 2 is what makes the same webhook arriving five times harmless. But note
 * what step 4 buys us: a claimed-but-unprocessed row (we crashed between 2 and
 * 3) does NOT swallow the retry. Deduplicating on "have I seen this id" alone
 * would turn one crash into a paid booking that never confirms.
 */
export async function handleWebhook(
  slug: string,
  rawBody: string,
  headers: Headers,
): Promise<WebhookOutcome> {
  const provider = getProviderBySlug(slug);
  if (!provider) {
    return { status: 404, body: { received: false, error: "UNKNOWN_PROVIDER" } };
  }

  let verified: unknown;
  try {
    verified = await provider.verifyWebhook(rawBody, headers);
  } catch (error) {
    if (error instanceof WebhookSignatureError) {
      // No body, no headers, no detail in the log: it is unauthenticated input.
      console.warn(`[webhooks] rejected unsigned ${slug} event`);
      return { status: 400, body: { received: false, error: "BAD_SIGNATURE" } };
    }
    throw error;
  }

  const event = provider.parseEvent(verified, rawBody);

  const claimed = await db
    .insert(webhookEvents)
    .values({
      provider: provider.dbName,
      eventId: event.id,
      // The hash, never the payload: it carries card metadata and e-mail.
      payloadHash: event.payloadHash,
    })
    .onConflictDoNothing({ target: [webhookEvents.provider, webhookEvents.eventId] })
    .returning({ eventId: webhookEvents.eventId });

  if (claimed.length === 0) {
    const done = await db
      .select({ eventId: webhookEvents.eventId })
      .from(webhookEvents)
      .where(
        and(
          eq(webhookEvents.provider, provider.dbName),
          eq(webhookEvents.eventId, event.id),
          isNotNull(webhookEvents.processedAt),
        ),
      )
      .limit(1);

    if (done.length > 0) {
      return { status: 200, body: { received: true, duplicate: true } };
    }
    // Claimed but never finished — a retry of a crashed attempt. Fall through.
  }

  const outcome = await processEvent(provider, event);

  await db
    .update(webhookEvents)
    .set({ processedAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(eq(webhookEvents.provider, provider.dbName), eq(webhookEvents.eventId, event.id)));

  return { status: 200, body: { received: true, outcome } };
}

async function processEvent(provider: PaymentProvider, event: NormalizedEvent): Promise<string> {
  switch (event.type) {
    case "PAYMENT_SUCCEEDED": {
      if (!event.bookingId) return "NO_BOOKING_REF";
      return applySucceededPayment({
        bookingId: event.bookingId,
        providerRef: event.providerRef,
        amountGr: event.amountGr,
        provider: provider.dbName,
      });
    }

    case "PAYMENT_FAILED": {
      // The hold stays alive until its TTL: the driver can pay again on the same
      // booking rather than losing the spot to a mistyped BLIK code.
      await markPaymentFailed({
        bookingId: event.bookingId,
        providerRef: event.providerRef,
        reason: event.failureReason,
      });
      return "PAYMENT_FAILED";
    }

    case "PAYMENT_REFUNDED": {
      await applyRefundEvent({
        providerRef: event.providerRef,
        bookingId: event.bookingId,
        refundedGr: event.refundedGr,
      });
      return "REFUND_RECORDED";
    }

    case "DISPUTE_CREATED":
      // MVP: flagged for a human. Reversing a booking automatically on a dispute
      // would let a chargeback fraudster cancel someone else's parked car.
      console.error(`[payments] dispute opened on ${event.providerRef ?? "unknown intent"}`);
      return "DISPUTE_FLAGGED";

    case "ACCOUNT_UPDATED": {
      // The host's KYC verdict changed. This is the ONLY writer of
      // charges_enabled / payouts_enabled, and it writes in both directions:
      // Stripe pulling payouts on a verified host must take their parkings out
      // of sale, not be quietly ignored because they were fine yesterday.
      if (!event.account) return "ACCOUNT_UPDATE_EMPTY";
      return applyAccountUpdate(event.account);
    }

    default:
      return "IGNORED";
  }
}
