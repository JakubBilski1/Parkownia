import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, payments, refundPolicies } from "@/db/schema";
import type { RefundRule } from "@/db/types";
import { getPaymentProvider } from "@/modules/payments/factory";
import { retractBookingFromPayout } from "@/modules/payouts/service";
import { DomainError } from "./errors";
import { fireAndForget, notifyBookingCancelled } from "./notify";
import { evaluateRefund } from "./refund-policy";

export type RefundQuote = {
  refundGr: number;
  refundPct: number;
  policy: { id: string; name: string; rules: RefundRule[] };
  /** Whole hours between now and the start of the booking; negative once it has started. */
  hoursBefore: number;
  priceGr: number;
};

export { evaluateRefund } from "./refund-policy";

async function loadForCancel(bookingId: string) {
  const rows = await db
    .select({
      booking: bookings,
      policyId: refundPolicies.id,
      policyName: refundPolicies.name,
      policyRules: refundPolicies.rules,
    })
    .from(bookings)
    // The policy is joined through bookings.refund_policy_id, not through
    // "the default one" — a booking is always settled by the version of the
    // policy that was in force when it was bought.
    .innerJoin(refundPolicies, eq(refundPolicies.id, bookings.refundPolicyId))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  const row = rows[0];
  if (!row) throw new DomainError("BOOKING_NOT_FOUND");
  return row;
}

/** `POST /api/bookings/:id/cancel?preview=true` — consequences before the click. */
export async function previewCancellation(bookingId: string): Promise<RefundQuote> {
  const row = await loadForCancel(bookingId);

  const { refundPct, refundGr, hoursBefore } = evaluateRefund({
    rules: row.policyRules,
    priceGr: row.booking.priceGr,
    startsAt: row.booking.startsAt,
  });

  return {
    refundGr: row.booking.status === "PENDING" ? 0 : refundGr,
    refundPct: row.booking.status === "PENDING" ? 0 : refundPct,
    policy: { id: row.policyId, name: row.policyName, rules: row.policyRules },
    hoursBefore,
    priceGr: row.booking.priceGr,
  };
}

export type CancellationResult = {
  refundGr: number;
  refundPct: number;
  /** The PSP call failed; the booking is cancelled and the money is owed. Admin picks it up. */
  refundPending: boolean;
  payoutAlreadyPaidOut: boolean;
};

/**
 * Cancel first (in one transaction), refund second. The order is deliberate:
 * releasing the spot must not depend on the PSP being up, and a refund we
 * recorded but failed to send is visible in the data (`refund_gr` set,
 * `payments.refunded_gr` still 0) instead of being lost. A spot released but
 * never refunded would be the worse failure.
 */
export async function cancelBooking(bookingId: string): Promise<CancellationResult> {
  const row = await loadForCancel(bookingId);
  const booking = row.booking;

  if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") {
    throw new DomainError("BOOKING_NOT_CANCELLABLE");
  }

  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.bookingId, bookingId))
    .limit(1);
  const payment = paymentRows[0];
  const wasPaid = payment?.status === "SUCCEEDED" || payment?.status === "PARTIALLY_REFUNDED";

  const quote = evaluateRefund({
    rules: row.policyRules,
    priceGr: booking.priceGr,
    startsAt: booking.startsAt,
  });
  const refundGr = wasPaid ? quote.refundGr : 0;
  const refundPct = wasPaid ? quote.refundPct : 0;

  const payoutState = await db.transaction(async (tx) => {
    const updated = await tx
      .update(bookings)
      .set({
        status: "CANCELLED",
        cancelledAt: sql`now()`,
        refundGr,
        pendingExpiresAt: null,
        updatedAt: sql`now()`,
      })
      // Status guard in the WHERE clause: two cancel clicks race, one updates.
      .where(sql`${bookings.id} = ${bookingId} AND ${bookings.status} IN ('PENDING', 'CONFIRMED')`)
      .returning({ id: bookings.id });

    if (updated.length === 0) throw new DomainError("BOOKING_NOT_CANCELLABLE");

    return retractBookingFromPayout(tx, bookingId);
  });

  const notifyCancelled = () =>
    fireAndForget(
      notifyBookingCancelled(bookingId, { refundGr, cancelledBy: "DRIVER" }),
      `booking-cancelled ${bookingId}`,
    );

  if (!wasPaid || refundGr === 0 || !payment?.providerRef) {
    notifyCancelled();
    return {
      refundGr,
      refundPct,
      refundPending: false,
      payoutAlreadyPaidOut: payoutState.paidOut,
    };
  }

  const provider = getPaymentProvider();
  try {
    await provider.refund({
      providerRef: payment.providerRef,
      amountGr: refundGr,
      // Host and platform give back their shares in proportion — the host does
      // not fund the platform's commission out of a cancellation.
      reverseTransfer: true,
      refundApplicationFee: true,
    });
  } catch {
    await db
      .update(payments)
      .set({ failedReason: "REFUND_FAILED", updatedAt: sql`now()` })
      .where(eq(payments.id, payment.id));

    notifyCancelled();
    return { refundGr, refundPct, refundPending: true, payoutAlreadyPaidOut: payoutState.paidOut };
  }

  notifyCancelled();
  return { refundGr, refundPct, refundPending: false, payoutAlreadyPaidOut: payoutState.paidOut };
}

/**
 * Money taken, no booking to show for it (docs/PAYMENTS.md §3.2). Used by the
 * webhook when a payment lands on a spot that is already gone. Full amount,
 * regardless of the cancellation policy — the driver did nothing wrong.
 */
export async function refundInFull(bookingId: string): Promise<{ refunded: boolean }> {
  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.bookingId, bookingId))
    .limit(1);

  const payment = paymentRows[0];
  if (!payment?.providerRef || payment.refundedGr >= payment.amountGr) {
    return { refunded: false };
  }

  const amountGr = payment.amountGr - payment.refundedGr;
  const provider = getPaymentProvider();

  await provider.refund({
    providerRef: payment.providerRef,
    amountGr,
    reverseTransfer: true,
    refundApplicationFee: true,
  });

  await db
    .update(bookings)
    .set({ refundGr: payment.amountGr, updatedAt: sql`now()` })
    .where(eq(bookings.id, bookingId));

  return { refunded: true };
}
