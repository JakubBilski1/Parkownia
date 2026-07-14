import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, payments, users } from "@/db/schema";
import type { PaymentMethod, PaymentProvider as PaymentProviderName } from "@/db/types";
import { confirmPaidBooking } from "@/modules/bookings/availability";
import { refundInFull } from "@/modules/bookings/cancel";
import { DomainError } from "@/modules/bookings/errors";
import {
  fireAndForget,
  notifyBookingConfirmed,
  notifyPaymentFailed,
} from "@/modules/bookings/notify";
import { getPaymentProvider } from "./factory";
import { resolveHostAccountForParking } from "./onboarding";

export type PaymentIntentForClient = {
  provider: PaymentProviderName;
  providerRef: string;
  clientSecret: string | null;
  publishableKey: string | null;
  /** Straight from booking.price_gr. The client sends no amount, ever. */
  amountGr: number;
  method: PaymentMethod;
  /** True for the mock provider: the checkout screen drives the webhook itself. */
  simulated: boolean;
};

export async function createPaymentIntentForBooking(input: {
  bookingId: string;
  method: PaymentMethod;
}): Promise<PaymentIntentForClient> {
  const rows = await db
    .select({
      booking: bookings,
      email: users.email,
    })
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.userId))
    .where(eq(bookings.id, input.bookingId))
    .limit(1);

  const row = rows[0];
  if (!row) throw new DomainError("BOOKING_NOT_FOUND");
  const booking = row.booking;

  if (booking.status === "EXPIRED") throw new DomainError("BOOKING_EXPIRED");
  if (booking.status !== "PENDING") throw new DomainError("BOOKING_NOT_PENDING");
  if (booking.pendingExpiresAt && booking.pendingExpiresAt.getTime() <= Date.now()) {
    throw new DomainError("BOOKING_EXPIRED");
  }

  const provider = getPaymentProvider();

  // The host's connected account, resolved from the parking being booked. Null
  // means the host cannot receive money — mid-onboarding, or payouts pulled by
  // Stripe since the parking was approved. The Stripe path then refuses to take
  // the money rather than hold it: a paid booking whose host cannot be paid is a
  // debt, not a sale (docs/PAYMENTS.md §2.2).
  const destinationAccountId = await resolveHostAccountForParking(booking.parkingId);

  if (provider.dbName === "STRIPE" && !destinationAccountId) {
    throw new DomainError("HOST_CANNOT_BE_PAID");
  }

  let intent;
  try {
    intent = await provider.createIntent({
      bookingId: booking.id,
      // The single source of the amount. Not a parameter of this function.
      amountGr: booking.priceGr,
      applicationFeeGr: booking.commissionGr,
      method: input.method,
      destinationAccountId,
      customerEmail: row.email,
    });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError("PAYMENT_PROVIDER_DOWN");
  }

  // One payment row per booking (UNIQUE booking_id). A retry after a BLIK
  // timeout is a NEW intent on the SAME booking — the row is overwritten, the
  // hold is untouched (docs/PAYMENTS.md §3.2).
  await db
    .insert(payments)
    .values({
      bookingId: booking.id,
      provider: provider.dbName,
      providerRef: intent.providerRef,
      method: input.method,
      amountGr: booking.priceGr,
      status: "INITIATED",
    })
    .onConflictDoUpdate({
      target: payments.bookingId,
      set: {
        provider: provider.dbName,
        providerRef: intent.providerRef,
        method: input.method,
        amountGr: booking.priceGr,
        status: "INITIATED",
        failedReason: null,
        updatedAt: sql`now()`,
      },
      // Never resurrect a settled payment: if the money already arrived, a new
      // intent must not reset the row to INITIATED.
      setWhere: sql`${payments.status} IN ('INITIATED', 'PROCESSING', 'FAILED')`,
    });

  return {
    provider: provider.dbName,
    providerRef: intent.providerRef,
    clientSecret: intent.clientSecret,
    publishableKey: intent.publishableKey,
    amountGr: booking.priceGr,
    method: input.method,
    simulated: intent.simulated ?? false,
  };
}

export type SucceededOutcome =
  | "CONFIRMED"
  | "ALREADY_CONFIRMED"
  | "REFUNDED_NO_SPOT"
  | "REFUNDED_CANCELLED"
  | "AMOUNT_MISMATCH";

/**
 * The single path from "money arrived" to "booking is real". Both the webhook
 * and the reconciliation cron come through here, so the amount check, the
 * transactional re-check and the emergency refund cannot diverge between them.
 */
export async function applySucceededPayment(input: {
  bookingId: string;
  providerRef: string | null;
  amountGr: number | null;
  provider: PaymentProviderName;
}): Promise<SucceededOutcome> {
  const rows = await db
    .select({ priceGr: bookings.priceGr })
    .from(bookings)
    .where(eq(bookings.id, input.bookingId))
    .limit(1);

  const booking = rows[0];
  if (!booking) throw new DomainError("BOOKING_NOT_FOUND");

  // Nothing outside our own database is trusted, least of all an amount
  // (docs/PAYMENTS.md §3.1). A mismatch is never confirmed and never refunded
  // on autopilot — it is a human's problem, flagged in the payment row.
  if (input.amountGr !== null && input.amountGr !== booking.priceGr) {
    await db
      .update(payments)
      .set({ failedReason: "AMOUNT_MISMATCH", updatedAt: sql`now()` })
      .where(eq(payments.bookingId, input.bookingId));

    console.error(
      `[payments] amount mismatch: booking=${input.bookingId} expected=${booking.priceGr} got=${input.amountGr}`,
    );
    return "AMOUNT_MISMATCH";
  }

  await db
    .insert(payments)
    .values({
      bookingId: input.bookingId,
      provider: input.provider,
      providerRef: input.providerRef,
      amountGr: booking.priceGr,
      status: "SUCCEEDED",
    })
    .onConflictDoUpdate({
      target: payments.bookingId,
      set: {
        status: "SUCCEEDED",
        providerRef: input.providerRef,
        failedReason: null,
        updatedAt: sql`now()`,
      },
      setWhere: sql`${payments.status} <> 'REFUNDED'`,
    });

  const result = await confirmPaidBooking(input.bookingId);

  if (result.outcome === "REFUND_REQUIRED") {
    await refundInFull(input.bookingId);
    await db
      .update(payments)
      .set({
        status: "REFUNDED",
        refundedGr: booking.priceGr,
        failedReason: result.reason === "SLOT_TAKEN" ? "SLOT_TAKEN_AFTER_PAYMENT" : "BOOKING_CANCELLED",
        updatedAt: sql`now()`,
      })
      .where(eq(payments.bookingId, input.bookingId));

    // We took money and have no spot to show for it. The driver hears that from
    // us, immediately — not from their bank statement three days later.
    fireAndForget(
      notifyPaymentFailed(input.bookingId, { charged: true }),
      `refund-notice ${input.bookingId}`,
    );

    return result.reason === "SLOT_TAKEN" ? "REFUNDED_NO_SPOT" : "REFUNDED_CANCELLED";
  }

  if (result.outcome === "CONFIRMED") {
    fireAndForget(
      notifyBookingConfirmed(input.bookingId),
      `booking-confirmed ${input.bookingId}`,
    );
  }

  return result.outcome;
}

/** BLIK not authorised in 60 s, card declined. The hold survives to its TTL — the driver can retry. */
export async function markPaymentFailed(input: {
  bookingId: string | null;
  providerRef: string | null;
  reason: string | null;
}): Promise<void> {
  const where = input.bookingId
    ? eq(payments.bookingId, input.bookingId)
    : input.providerRef
      ? eq(payments.providerRef, input.providerRef)
      : null;
  if (!where) return;

  const failed = await db
    .update(payments)
    .set({ status: "FAILED", failedReason: input.reason, updatedAt: sql`now()` })
    .where(and(where, sql`${payments.status} IN ('INITIATED', 'PROCESSING')`))
    .returning({ bookingId: payments.bookingId });

  const bookingId = failed[0]?.bookingId;
  if (bookingId) {
    // charged: false — this mail's whole job is to say "no money left your
    // account, and your spot is still held until X".
    fireAndForget(
      notifyPaymentFailed(bookingId, { charged: false }),
      `payment-failed ${bookingId}`,
    );
  }
}

export async function applyRefundEvent(input: {
  providerRef: string | null;
  bookingId: string | null;
  refundedGr: number | null;
}): Promise<void> {
  if (input.refundedGr === null) return;

  const where = input.providerRef
    ? eq(payments.providerRef, input.providerRef)
    : input.bookingId
      ? eq(payments.bookingId, input.bookingId)
      : null;
  if (!where) return;

  await db
    .update(payments)
    .set({
      refundedGr: input.refundedGr,
      status: sql`CASE WHEN ${input.refundedGr} >= ${payments.amountGr} THEN 'REFUNDED'::payment_status ELSE 'PARTIALLY_REFUNDED'::payment_status END`,
      updatedAt: sql`now()`,
    })
    .where(where);
}
