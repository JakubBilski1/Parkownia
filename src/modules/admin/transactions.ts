import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, events, parkings, payoutItems, payouts, payments, users } from "@/db/schema";
import { tstz } from "@/db/time";
import { AdminError, notFound } from "./errors";
import { decodeCursor, toPage, type Page } from "./pagination";
import { refundThroughProvider } from "./ports";
import { refundSchema, transactionsSchema } from "./schemas";

export type TransactionRow = {
  id: string;
  createdAt: Date;
  code: string;
  status: (typeof bookings.$inferSelect)["status"];
  startsAt: Date;
  endsAt: Date;
  spots: number;
  priceGr: number;
  commissionGr: number;
  commissionRatePct: number;
  hostPayoutGr: number;
  refundGr: number | null;
  paymentStatus: (typeof payments.$inferSelect)["status"] | null;
  paymentProvider: (typeof payments.$inferSelect)["provider"] | null;
  paymentMethod: (typeof payments.$inferSelect)["method"] | null;
  /** What the driver was actually charged. Refundability is measured against this. */
  paidGr: number | null;
  refundedGr: number | null;
  parkingId: string;
  parkingTitle: string | null;
  hostId: string;
  driverEmail: string;
  eventTitle: string | null;
};

export async function listTransactions(input: unknown): Promise<Page<TransactionRow>> {
  const { status, from, to, q, parkingId, hostId, limit, cursor: rawCursor } =
    transactionsSchema.parse(input);
  const cursor = decodeCursor(rawCursor);

  const rows = await db
    .select({
      id: bookings.id,
      createdAt: bookings.createdAt,
      code: bookings.code,
      status: bookings.status,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      spots: bookings.spots,
      priceGr: bookings.priceGr,
      commissionGr: bookings.commissionGr,
      commissionRatePct: bookings.commissionRatePct,
      hostPayoutGr: bookings.hostPayoutGr,
      refundGr: bookings.refundGr,
      paymentStatus: payments.status,
      paymentProvider: payments.provider,
      paymentMethod: payments.method,
      paidGr: payments.amountGr,
      refundedGr: payments.refundedGr,
      parkingId: parkings.id,
      parkingTitle: parkings.title,
      hostId: parkings.ownerId,
      driverEmail: users.email,
      eventTitle: events.title,
    })
    .from(bookings)
    .innerJoin(parkings, eq(parkings.id, bookings.parkingId))
    .innerJoin(users, eq(users.id, bookings.userId))
    .leftJoin(payments, eq(payments.bookingId, bookings.id))
    .leftJoin(events, eq(events.id, bookings.eventId))
    .where(
      and(
        status ? eq(bookings.status, status) : undefined,
        from ? gte(bookings.createdAt, from) : undefined,
        to ? lt(bookings.createdAt, to) : undefined,
        parkingId ? eq(bookings.parkingId, parkingId) : undefined,
        hostId ? eq(parkings.ownerId, hostId) : undefined,
        q ? sql`(${bookings.code} ILIKE ${`%${q}%`} OR ${users.email} ILIKE ${`%${q}%`})` : undefined,
        cursor
          ? sql`(${bookings.createdAt}, ${bookings.id}) < (${tstz(cursor.createdAt)}, ${cursor.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(desc(bookings.createdAt), desc(bookings.id))
    .limit(limit + 1);

  return toPage(rows, limit);
}

export type RefundResultSummary = {
  bookingId: string;
  code: string;
  /** What we just gave back to the driver. */
  refundedNowGr: number;
  /** Everything given back on this booking so far. */
  totalRefundedGr: number;
  hostShareGr: number;
  platformShareGr: number;
  bookingStatus: (typeof bookings.$inferSelect)["status"];
  /**
   * The host had already been paid their share of this booking. The money is out
   * of our hands — the operator has to claw it back from the next payout by hand.
   */
  hostAlreadyPaidGr: number;
  providerRefundRef: string | null;
};

/**
 * Full or partial refund outside the cancellation policy — the intervention path
 * (API_SPEC §6). The policy-driven path lives in the bookings module.
 */
export async function refundBooking(input: unknown): Promise<RefundResultSummary> {
  const { bookingId, amountGr } = refundSchema.parse(input);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        bookingId: bookings.id,
        code: bookings.code,
        bookingStatus: bookings.status,
        priceGr: bookings.priceGr,
        hostPayoutGr: bookings.hostPayoutGr,
        refundGr: bookings.refundGr,
        cancelledAt: bookings.cancelledAt,
        paymentId: payments.id,
        provider: payments.provider,
        providerRef: payments.providerRef,
        paymentStatus: payments.status,
        paidGr: payments.amountGr,
        alreadyRefundedGr: payments.refundedGr,
      })
      .from(bookings)
      .innerJoin(payments, eq(payments.bookingId, bookings.id))
      .where(eq(bookings.id, bookingId))
      .for("update")
      .limit(1);

    if (!row) {
      throw notFound("Opłacona rezerwacja o tym numerze");
    }

    if (row.paymentStatus !== "SUCCEEDED" && row.paymentStatus !== "PARTIALLY_REFUNDED") {
      throw new AdminError(
        "INVALID_STATE",
        422,
        "Tej rezerwacji nie da się zwrócić — płatność nigdy nie doszła do skutku. Nic nie pobraliśmy od kierowcy.",
      );
    }

    const refundableGr = row.paidGr - row.alreadyRefundedGr;
    if (refundableGr <= 0) {
      throw new AdminError(
        "NOTHING_TO_REFUND",
        422,
        "Ta rezerwacja została już zwrócona w całości. Kierowca ma swoje pieniądze.",
      );
    }

    const refundNowGr = amountGr ?? refundableGr;
    if (refundNowGr > refundableGr) {
      throw new AdminError(
        "AMOUNT_OUT_OF_RANGE",
        422,
        `Kwota przekracza to, co zostało do zwrotu (${(refundableGr / 100).toFixed(2).replace(".", ",")} zł). Nic nie zostało zwrócone.`,
      );
    }

    // Proportional split (PAYMENTS.md §2.3): the host and the platform each give
    // back their own part of what the driver paid.
    const hostShareGr = Math.round((refundNowGr * row.hostPayoutGr) / row.priceGr);
    const platformShareGr = refundNowGr - hostShareGr;

    // The PSP call sits inside the transaction, holding the payment row lock. It
    // costs throughput and buys the only thing that matters here: two operators
    // clicking "Zwróć" at once cannot double-refund. Admin volume is a handful of
    // refunds a day.
    const { providerRefundRef } = await refundThroughProvider({
      paymentId: row.paymentId,
      provider: row.provider,
      providerRef: row.providerRef,
      amountGr: refundNowGr,
      hostShareGr,
    });

    const totalRefundedGr = row.alreadyRefundedGr + refundNowGr;
    const fullyRefunded = totalRefundedGr >= row.paidGr;
    const now = new Date();

    await tx
      .update(payments)
      .set({
        refundedGr: totalRefundedGr,
        status: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
        updatedAt: now,
      })
      .where(eq(payments.id, row.paymentId));

    const bookingRefundGr = (row.refundGr ?? 0) + refundNowGr;
    const bookingStatus = fullyRefunded ? "CANCELLED" : row.bookingStatus;

    await tx
      .update(bookings)
      .set({
        refundGr: bookingRefundGr,
        status: bookingStatus,
        cancelledAt: fullyRefunded ? (row.cancelledAt ?? now) : row.cancelledAt,
        updatedAt: now,
      })
      .where(eq(bookings.id, bookingId));

    const hostAlreadyPaidGr = await adjustPayoutForRefund(tx, {
      bookingId,
      hostPayoutGr: row.hostPayoutGr,
      priceGr: row.priceGr,
      totalRefundGr: bookingRefundGr,
      hostShareGr,
    });

    return {
      bookingId,
      code: row.code,
      refundedNowGr: refundNowGr,
      totalRefundedGr,
      hostShareGr,
      platformShareGr,
      bookingStatus,
      hostAlreadyPaidGr,
      providerRefundRef,
    };
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Returns how much of the refund the host had already been paid (0 when the
 * payout is still open and could be corrected in place).
 */
async function adjustPayoutForRefund(
  tx: Tx,
  args: {
    bookingId: string;
    hostPayoutGr: number;
    priceGr: number;
    totalRefundGr: number;
    hostShareGr: number;
  },
): Promise<number> {
  const [item] = await tx
    .select({
      itemId: payoutItems.id,
      payoutId: payouts.id,
      payoutStatus: payouts.status,
    })
    .from(payoutItems)
    .innerJoin(payouts, eq(payouts.id, payoutItems.payoutId))
    .where(eq(payoutItems.bookingId, args.bookingId))
    .limit(1);

  // Not on a payout yet: the next payout run recomputes the host's due from
  // bookings.refund_gr, so there is nothing to correct.
  if (!item) return 0;

  if (item.payoutStatus !== "PENDING") return args.hostShareGr;

  const hostDueGr =
    args.hostPayoutGr - Math.round((args.totalRefundGr * args.hostPayoutGr) / args.priceGr);

  if (hostDueGr <= 0) {
    await tx.delete(payoutItems).where(eq(payoutItems.id, item.itemId));
  } else {
    await tx
      .update(payoutItems)
      .set({ amountGr: hostDueGr, updatedAt: new Date() })
      .where(eq(payoutItems.id, item.itemId));
  }

  await tx
    .update(payouts)
    .set({
      amountGr: sql`(
        SELECT coalesce(sum(${payoutItems.amountGr}), 0)::int
        FROM ${payoutItems} WHERE ${payoutItems.payoutId} = ${payouts.id}
      )`,
      updatedAt: new Date(),
    })
    .where(eq(payouts.id, item.payoutId));

  // A payout whose every booking was refunded is not a 0 zł transfer — it is no
  // transfer, and it should not sit in the report waiting to be "paid".
  await tx
    .delete(payouts)
    .where(and(eq(payouts.id, item.payoutId), eq(payouts.amountGr, 0), eq(payouts.status, "PENDING")));

  return 0;
}
