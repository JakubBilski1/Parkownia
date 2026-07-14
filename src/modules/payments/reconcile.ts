import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, payments } from "@/db/schema";
import { getPaymentProvider } from "./factory";
import { applySucceededPayment, markPaymentFailed } from "./service";

export type ReconcileResult = {
  checked: number;
  confirmed: number;
  failed: number;
  refunded: number;
  stillPending: number;
};

/** A webhook that has not arrived in five minutes is a webhook that may never arrive. */
const STALE_AFTER_MINUTES = 5;

/**
 * The safety net under the webhook (docs/PAYMENTS.md §3.2). Stripe retries for
 * three days, but "the driver's money left their account and our screen says
 * unpaid" is not a state we wait three days to fix. Every few minutes we ask the
 * PSP directly about intents that went quiet.
 *
 * It reuses applySucceededPayment(), so a payment reconciled here is confirmed
 * by the same locked re-check — and refunded the same way if the spot is gone.
 */
export async function reconcilePendingPayments(): Promise<ReconcileResult> {
  const provider = getPaymentProvider();

  const stale = await db
    .select({
      bookingId: payments.bookingId,
      providerRef: payments.providerRef,
    })
    .from(payments)
    .innerJoin(bookings, eq(bookings.id, payments.bookingId))
    .where(
      and(
        eq(payments.provider, provider.dbName),
        inArray(payments.status, ["INITIATED", "PROCESSING"]),
        lte(payments.createdAt, sql`now() - interval '${sql.raw(String(STALE_AFTER_MINUTES))} minutes'`),
        inArray(bookings.status, ["PENDING", "EXPIRED"]),
      ),
    )
    .limit(200);

  const result: ReconcileResult = {
    checked: 0,
    confirmed: 0,
    failed: 0,
    refunded: 0,
    stillPending: 0,
  };

  for (const row of stale) {
    if (!row.providerRef) continue;
    result.checked += 1;

    let snapshot;
    try {
      snapshot = await provider.retrieveIntent(row.providerRef);
    } catch {
      console.error(`[reconcile] PSP lookup failed for booking ${row.bookingId}`);
      result.stillPending += 1;
      continue;
    }

    switch (snapshot.status) {
      case "SUCCEEDED": {
        const outcome = await applySucceededPayment({
          bookingId: row.bookingId,
          providerRef: row.providerRef,
          amountGr: snapshot.amountGr,
          provider: provider.dbName,
        });
        if (outcome === "CONFIRMED" || outcome === "ALREADY_CONFIRMED") result.confirmed += 1;
        else if (outcome === "REFUNDED_NO_SPOT" || outcome === "REFUNDED_CANCELLED") result.refunded += 1;
        else result.failed += 1;
        break;
      }

      case "FAILED":
      case "CANCELED":
        await markPaymentFailed({
          bookingId: row.bookingId,
          providerRef: row.providerRef,
          reason: snapshot.failureReason ?? snapshot.status.toLowerCase(),
        });
        result.failed += 1;
        break;

      default:
        result.stillPending += 1;
    }
  }

  return result;
}
