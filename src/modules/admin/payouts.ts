import { addDays } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, parkings, payoutItems, payouts, payments, users } from "@/db/schema";
import { AdminError, notFound } from "./errors";
import { generatePayoutsSchema, markPaidSchema, payoutReportSchema } from "./schemas";
import { APP_TIME_ZONE } from "@/lib/format";

/** A booking is owed to the host once it is paid for and the stay is over. */
const SETTLEABLE_BOOKING_STATUSES = ["CONFIRMED", "USED"] as const;

/**
 * The host's frozen share minus their proportional part of any refund. We never
 * rewrite `host_payout_gr` — it is frozen at booking time (DATA_MODEL §5) and the
 * money-split CHECK constraint depends on it. The refund is applied here instead.
 */
const hostDueGrSql = sql<number>`(
  ${bookings.hostPayoutGr}
  - round(
      coalesce(${bookings.refundGr}, 0)::numeric * ${bookings.hostPayoutGr}
      / nullif(${bookings.priceGr}, 0)
    )
)::int`;

const hostNameSql = sql<
  string | null
>`nullif(trim(concat_ws(' ', ${users.firstName}, ${users.lastName})), '')`;

/** Calendar dates are local ("the week of the 25th"); the database is UTC. */
function periodBoundsUtc(periodStart: string, periodEnd: string) {
  return {
    startUtc: fromZonedTime(`${periodStart} 00:00:00`, APP_TIME_ZONE),
    endUtc: addDays(fromZonedTime(`${periodEnd} 00:00:00`, APP_TIME_ZONE), 1),
  };
}

export type UnsettledHost = {
  hostId: string;
  hostName: string | null;
  hostEmail: string;
  bookingCount: number;
  amountGr: number;
  bankAccounts: string[];
};

/**
 * Everything owed but not yet on a payout, whenever it happened. A booking that
 * one run missed must be swept up by the next one, or the host is never paid.
 */
export async function listUnsettled(before: Date): Promise<UnsettledHost[]> {
  const rows = await db
    .select({
      hostId: users.id,
      hostName: hostNameSql,
      hostEmail: users.email,
      bookingCount: sql<number>`count(*)::int`,
      amountGr: sql<number>`coalesce(sum(${hostDueGrSql}), 0)::int`,
      bankAccounts: sql<
        string[]
      >`coalesce(array_agg(DISTINCT ${parkings.payoutBankAccount}) FILTER (WHERE ${parkings.payoutBankAccount} IS NOT NULL), '{}')`,
    })
    .from(bookings)
    .innerJoin(parkings, eq(parkings.id, bookings.parkingId))
    .innerJoin(users, eq(users.id, parkings.ownerId))
    .innerJoin(payments, eq(payments.bookingId, bookings.id))
    .leftJoin(payoutItems, eq(payoutItems.bookingId, bookings.id))
    .where(
      and(
        inArray(bookings.status, [...SETTLEABLE_BOOKING_STATUSES]),
        eq(payments.status, "SUCCEEDED"),
        lt(bookings.endsAt, before),
        isNull(payoutItems.id),
      ),
    )
    .groupBy(users.id, users.email, users.firstName, users.lastName)
    .having(sql`coalesce(sum(${hostDueGrSql}), 0) > 0`)
    .orderBy(desc(sql`coalesce(sum(${hostDueGrSql}), 0)`));

  return rows;
}

export type PayoutRow = {
  id: string;
  hostId: string;
  hostName: string | null;
  hostEmail: string;
  periodStart: string;
  periodEnd: string;
  amountGr: number;
  itemCount: number;
  status: (typeof payouts.$inferSelect)["status"];
  providerRef: string | null;
  paidAt: Date | null;
};

export type PayoutReport = {
  status: (typeof payouts.$inferSelect)["status"];
  payouts: PayoutRow[];
  payoutsTotalGr: number;
  unsettled: UnsettledHost[];
  unsettledTotalGr: number;
};

export async function getPayoutReport(input: unknown): Promise<PayoutReport> {
  const { status } = payoutReportSchema.parse(input);

  const rows = await db
    .select({
      id: payouts.id,
      hostId: payouts.hostId,
      hostName: hostNameSql,
      hostEmail: users.email,
      periodStart: payouts.periodStart,
      periodEnd: payouts.periodEnd,
      amountGr: payouts.amountGr,
      itemCount: sql<number>`(
        SELECT count(*)::int FROM ${payoutItems} WHERE ${payoutItems.payoutId} = ${payouts.id}
      )`,
      status: payouts.status,
      providerRef: payouts.providerRef,
      paidAt: payouts.paidAt,
    })
    .from(payouts)
    .innerJoin(users, eq(users.id, payouts.hostId))
    .where(eq(payouts.status, status))
    .orderBy(desc(payouts.periodEnd), desc(payouts.amountGr));

  const unsettled = status === "PENDING" ? await listUnsettled(new Date()) : [];

  return {
    status,
    payouts: rows,
    payoutsTotalGr: rows.reduce((sum, row) => sum + row.amountGr, 0),
    unsettled,
    unsettledTotalGr: unsettled.reduce((sum, row) => sum + row.amountGr, 0),
  };
}

export type GeneratePayoutsResult = {
  periodStart: string;
  periodEnd: string;
  createdPayouts: number;
  settledBookings: number;
  totalGr: number;
  /** Hosts whose payout for this period was already paid out — nothing was added. */
  skippedHosts: string[];
};

/**
 * Materialises `payouts` + `payout_items` for everything settleable that ended
 * before the period closes. Idempotent: the unique index on
 * `payout_items.booking_id` means a re-run cannot pay a booking twice.
 */
export async function generatePayouts(input: unknown): Promise<GeneratePayoutsResult> {
  const { periodStart, periodEnd } = generatePayoutsSchema.parse(input);
  const { endUtc } = periodBoundsUtc(periodStart, periodEnd);

  return db.transaction(async (tx) => {
    const settleable = await tx
      .select({
        bookingId: bookings.id,
        hostId: parkings.ownerId,
        amountGr: hostDueGrSql,
      })
      .from(bookings)
      .innerJoin(parkings, eq(parkings.id, bookings.parkingId))
      .innerJoin(payments, eq(payments.bookingId, bookings.id))
      .leftJoin(payoutItems, eq(payoutItems.bookingId, bookings.id))
      .where(
        and(
          inArray(bookings.status, [...SETTLEABLE_BOOKING_STATUSES]),
          eq(payments.status, "SUCCEEDED"),
          lt(bookings.endsAt, endUtc),
          isNull(payoutItems.id),
        ),
      );

    const owed = settleable.filter((row) => row.amountGr > 0);
    if (owed.length === 0) {
      return {
        periodStart,
        periodEnd,
        createdPayouts: 0,
        settledBookings: 0,
        totalGr: 0,
        skippedHosts: [],
      };
    }

    const hostIds = [...new Set(owed.map((row) => row.hostId))];

    await tx
      .insert(payouts)
      .values(hostIds.map((hostId) => ({ hostId, periodStart, periodEnd, amountGr: 0 })))
      .onConflictDoNothing({
        target: [payouts.hostId, payouts.periodStart, payouts.periodEnd],
      });

    const periodPayouts = await tx
      .select({ id: payouts.id, hostId: payouts.hostId, status: payouts.status })
      .from(payouts)
      .where(
        and(
          inArray(payouts.hostId, hostIds),
          eq(payouts.periodStart, periodStart),
          eq(payouts.periodEnd, periodEnd),
        ),
      );

    // A payout already sent to the bank is closed. Its stragglers belong to the
    // next period, not to a row somebody already reconciled.
    const openByHost = new Map(
      periodPayouts.filter((row) => row.status === "PENDING").map((row) => [row.hostId, row.id]),
    );
    const skippedHosts = periodPayouts
      .filter((row) => row.status !== "PENDING")
      .map((row) => row.hostId);

    const items = owed
      .filter((row) => openByHost.has(row.hostId))
      .map((row) => ({
        payoutId: openByHost.get(row.hostId) as string,
        bookingId: row.bookingId,
        amountGr: row.amountGr,
      }));

    if (items.length > 0) {
      await tx.insert(payoutItems).values(items).onConflictDoNothing({
        target: payoutItems.bookingId,
      });
    }

    const openIds = [...openByHost.values()];
    if (openIds.length > 0) {
      await tx
        .update(payouts)
        .set({
          amountGr: sql`(
            SELECT coalesce(sum(${payoutItems.amountGr}), 0)::int
            FROM ${payoutItems} WHERE ${payoutItems.payoutId} = ${payouts.id}
          )`,
          updatedAt: new Date(),
        })
        .where(inArray(payouts.id, openIds));
    }

    // Payouts that ended up empty (every candidate booking was already settled)
    // would otherwise sit in the report as 0 zł rows.
    await tx
      .delete(payouts)
      .where(and(inArray(payouts.id, openIds), eq(payouts.amountGr, 0), eq(payouts.status, "PENDING")));

    return {
      periodStart,
      periodEnd,
      createdPayouts: openIds.length,
      settledBookings: items.length,
      totalGr: items.reduce((sum, item) => sum + item.amountGr, 0),
      skippedHosts,
    };
  });
}

export type MarkPaidResult = {
  payoutId: string;
  amountGr: number;
  paidAt: Date;
};

export async function markPayoutPaid(input: unknown): Promise<MarkPaidResult> {
  const { payoutId, providerRef } = markPaidSchema.parse(input);

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ id: payouts.id, status: payouts.status, amountGr: payouts.amountGr })
      .from(payouts)
      .where(eq(payouts.id, payoutId))
      .for("update")
      .limit(1);

    if (!current) throw notFound("Wypłata");

    if (current.status === "PAID") {
      throw new AdminError(
        "ALREADY_PAID",
        422,
        "Ta wypłata jest już oznaczona jako wypłacona. Nie wysyłaj przelewu drugi raz — odśwież listę.",
      );
    }

    const paidAt = new Date();
    await tx
      .update(payouts)
      .set({ status: "PAID", providerRef, paidAt, updatedAt: paidAt })
      .where(eq(payouts.id, payoutId));

    return { payoutId, amountGr: current.amountGr, paidAt };
  });
}

/** Money owed to hosts right now: already-cut payouts plus what is not on one yet. */
export async function getOutstandingPayoutGr(): Promise<number> {
  const [pendingRow] = await db
    .select({ total: sql<number>`coalesce(sum(${payouts.amountGr}), 0)::int` })
    .from(payouts)
    .where(eq(payouts.status, "PENDING"));

  const unsettled = await listUnsettled(new Date());
  const unsettledTotal = unsettled.reduce((sum, row) => sum + row.amountGr, 0);

  return (pendingRow?.total ?? 0) + unsettledTotal;
}

export { hostDueGrSql };
