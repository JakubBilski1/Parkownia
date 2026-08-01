import { and, count, desc, eq, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import { bookings, payoutItems, payouts, users } from "@/db/schema";
import type { PayoutStatus } from "@/db/types";
import { countMyParkings } from "@/modules/parkings/service";

export type PayoutReportRow = {
  payoutId: string;
  hostId: string;
  hostEmail: string;
  hostName: string | null;
  periodStart: string;
  periodEnd: string;
  amountGr: number;
  bookingCount: number;
  status: PayoutStatus;
  paidAt: Date | null;
};

export type PayoutReport = {
  rows: PayoutReportRow[];
  totalGr: number;
};

/** Admin answer to "who gets how much this week". */
export async function getPayoutReport(input?: { status?: PayoutStatus }): Promise<PayoutReport> {
  const status = input?.status;

  const rows = await db
    .select({
      payoutId: payouts.id,
      hostId: payouts.hostId,
      hostEmail: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      periodStart: payouts.periodStart,
      periodEnd: payouts.periodEnd,
      amountGr: payouts.amountGr,
      status: payouts.status,
      paidAt: payouts.paidAt,
      bookingCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${payoutItems} WHERE ${payoutItems.payoutId} = ${payouts.id}
      )`,
    })
    .from(payouts)
    .innerJoin(users, eq(users.id, payouts.hostId))
    .where(status ? eq(payouts.status, status) : undefined)
    .orderBy(desc(payouts.periodStart), desc(payouts.amountGr));

  return {
    rows: rows.map((row) => ({
      payoutId: row.payoutId,
      hostId: row.hostId,
      hostEmail: row.hostEmail,
      hostName: [row.firstName, row.lastName].filter(Boolean).join(" ") || null,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      amountGr: row.amountGr,
      bookingCount: row.bookingCount,
      status: row.status,
      paidAt: row.paidAt,
    })),
    totalGr: rows.reduce((acc, row) => acc + row.amountGr, 0),
  };
}

export type HostPayoutRow = {
  id: string;
  amountGr: number;
  status: PayoutStatus;
  paidAt: Date | null;
  periodEnd: string;
};

export type HostEarnings = {
  totalGr: number;
  pendingPayoutGr: number;
  bookingCount: number;
  /**
   * Lets the dashboard tell "no parkings yet" apart from "a parking that has not
   * earned anything yet". Without it the empty state has to guess, and a host who
   * just listed a lot would be told they have earned 0 zł instead of being shown
   * how to get their first booking.
   */
  parkingsCount: number;
  /**
   * Where the host's parkings stand with moderation. The dashboard used to show
   * a host with one REJECTED parking two zeroes and nothing else: no sale, no
   * reason, and no hint that the decision was already made and was theirs to
   * answer. The reason itself lives on the parking; this is only enough to say
   * so on the first screen.
   */
  moderation: {
    active: number;
    pendingReview: number;
    rejected: number;
    draft: number;
  };
  payouts: HostPayoutRow[];
};

/** GET /api/host/earnings (docs/API_SPEC.md §8). */
export async function getHostEarnings(hostId: string): Promise<HostEarnings> {
  const [settled] = await db
    .select({
      totalGr: sum(payoutItems.amountGr).mapWith(Number),
      bookingCount: count(payoutItems.id),
    })
    .from(payoutItems)
    .innerJoin(bookings, eq(bookings.id, payoutItems.bookingId))
    .innerJoin(payouts, eq(payouts.id, payoutItems.payoutId))
    .where(eq(payouts.hostId, hostId));

  const [pending] = await db
    .select({ amountGr: sum(payouts.amountGr).mapWith(Number) })
    .from(payouts)
    .where(and(eq(payouts.hostId, hostId), eq(payouts.status, "PENDING")));

  const owned = await countMyParkings(hostId);

  const history = await db
    .select({
      id: payouts.id,
      amountGr: payouts.amountGr,
      status: payouts.status,
      paidAt: payouts.paidAt,
      periodEnd: payouts.periodEnd,
    })
    .from(payouts)
    .where(eq(payouts.hostId, hostId))
    .orderBy(desc(payouts.periodEnd))
    .limit(24);

  return {
    totalGr: settled?.totalGr ?? 0,
    pendingPayoutGr: pending?.amountGr ?? 0,
    bookingCount: settled?.bookingCount ?? 0,
    parkingsCount: owned.total,
    moderation: {
      active: owned.active,
      pendingReview: owned.pendingReview,
      rejected: owned.rejected,
      draft: owned.draft,
    },
    payouts: history,
  };
}
