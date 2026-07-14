import { and, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, commissionRules, parkings, payoutItems, payouts } from "@/db/schema";
import type { OwnerType } from "@/db/types";

import { computeCommission, type CommissionSplit } from "./commission";

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Executor = Db | Tx;

export { computeCommission, type CommissionSplit } from "./commission";

/**
 * PARKING > USER > GLOBAL_(ownerType), and within one scope the newest rule whose
 * `valid_from` has already passed. Resolved in SQL so the ordering cannot drift
 * from the ordering the admin panel shows.
 */
export async function resolveCommissionRatePct(
  exec: Executor,
  input: { parkingId: string; ownerId: string; ownerType: OwnerType },
): Promise<number> {
  const globalScope = input.ownerType === "BUSINESS" ? "GLOBAL_BUSINESS" : "GLOBAL_INDIVIDUAL";

  const rows = await exec
    .select({ ratePct: commissionRules.ratePct })
    .from(commissionRules)
    .where(
      and(
        lt(commissionRules.validFrom, sql`now()`),
        sql`(
          (${commissionRules.scope} = 'PARKING' AND ${commissionRules.parkingId} = ${input.parkingId})
          OR (${commissionRules.scope} = 'USER' AND ${commissionRules.userId} = ${input.ownerId})
          OR ${commissionRules.scope} = ${globalScope}
        )`,
      ),
    )
    .orderBy(
      sql`CASE ${commissionRules.scope}
            WHEN 'PARKING' THEN 0
            WHEN 'USER' THEN 1
            ELSE 2
          END`,
      sql`${commissionRules.validFrom} DESC`,
    )
    .limit(1);

  const rule = rows[0];
  if (!rule) {
    // Refusing to guess: an unpriced commission means we do not know what the
    // host is owed, and a booking whose split we cannot compute must not exist.
    throw new Error(`No commission rule resolves for parking ${input.parkingId}`);
  }
  return rule.ratePct;
}

export async function resolveCommissionSplit(
  exec: Executor,
  input: { parkingId: string; ownerId: string; ownerType: OwnerType; priceGr: number },
): Promise<CommissionSplit> {
  const ratePct = await resolveCommissionRatePct(exec, input);
  return computeCommission(input.priceGr, ratePct);
}

/* -------------------------------------------------------------------------- */
/* Accrual                                                                    */
/* -------------------------------------------------------------------------- */

export type AccrualResult = {
  periodStart: string;
  periodEnd: string;
  payoutCount: number;
  bookingCount: number;
  amountGr: number;
};

/**
 * Mirror of what the PSP pays out, not the payout itself (docs/PAYMENTS.md §4):
 * with Stripe Connect the money already moved via the destination charge. These
 * rows exist so an admin can answer "who got how much, for which bookings".
 *
 * Settled = booking finished inside the period and was actually honoured
 * (CONFIRMED or USED). Cancelled/expired bookings never reach here, and a
 * booking already carried by an item is skipped — payout_items.booking_id is
 * UNIQUE, so a double run is a no-op rather than a double payment.
 */
export async function accruePayoutsForPeriod(
  periodStart: Date,
  periodEnd: Date,
): Promise<AccrualResult> {
  const startDate = periodStart.toISOString().slice(0, 10);
  const endDate = periodEnd.toISOString().slice(0, 10);

  return db.transaction(async (tx) => {
    const settled = await tx
      .select({
        hostId: parkings.ownerId,
        bookingId: bookings.id,
        amountGr: bookings.hostPayoutGr,
      })
      .from(bookings)
      .innerJoin(parkings, eq(parkings.id, bookings.parkingId))
      .leftJoin(payoutItems, eq(payoutItems.bookingId, bookings.id))
      .where(
        and(
          inArray(bookings.status, ["CONFIRMED", "USED"]),
          gte(bookings.endsAt, periodStart),
          lt(bookings.endsAt, periodEnd),
          isNull(payoutItems.id),
        ),
      );

    const byHost = new Map<string, { bookingId: string; amountGr: number }[]>();
    for (const row of settled) {
      const list = byHost.get(row.hostId) ?? [];
      list.push({ bookingId: row.bookingId, amountGr: row.amountGr });
      byHost.set(row.hostId, list);
    }

    let amountGr = 0;
    let bookingCount = 0;

    for (const [hostId, items] of byHost) {
      const hostTotal = items.reduce((sum, item) => sum + item.amountGr, 0);

      const [payout] = await tx
        .insert(payouts)
        .values({
          hostId,
          periodStart: startDate,
          periodEnd: endDate,
          amountGr: hostTotal,
          status: "PENDING",
          provider: "STRIPE",
        })
        .onConflictDoUpdate({
          target: [payouts.hostId, payouts.periodStart, payouts.periodEnd],
          set: { amountGr: sql`${payouts.amountGr} + ${hostTotal}`, updatedAt: sql`now()` },
        })
        .returning({ id: payouts.id });

      if (!payout) continue;

      await tx
        .insert(payoutItems)
        .values(items.map((item) => ({ payoutId: payout.id, bookingId: item.bookingId, amountGr: item.amountGr })))
        .onConflictDoNothing({ target: payoutItems.bookingId });

      amountGr += hostTotal;
      bookingCount += items.length;
    }

    return {
      periodStart: startDate,
      periodEnd: endDate,
      payoutCount: byHost.size,
      bookingCount,
      amountGr,
    };
  });
}

/**
 * A refunded booking must not stay in an unpaid payout. If the payout already
 * went out, the item stays and the host carries a negative balance — settling
 * that is a manual admin action in the MVP, and this returns `paidOut: true` so
 * the caller can say so out loud instead of silently losing the money.
 */
export async function retractBookingFromPayout(
  exec: Executor,
  bookingId: string,
): Promise<{ retracted: boolean; paidOut: boolean }> {
  const rows = await exec
    .select({
      itemId: payoutItems.id,
      amountGr: payoutItems.amountGr,
      payoutId: payouts.id,
      status: payouts.status,
    })
    .from(payoutItems)
    .innerJoin(payouts, eq(payouts.id, payoutItems.payoutId))
    .where(eq(payoutItems.bookingId, bookingId))
    .limit(1);

  const item = rows[0];
  if (!item) return { retracted: false, paidOut: false };
  if (item.status !== "PENDING") return { retracted: false, paidOut: true };

  await exec.delete(payoutItems).where(eq(payoutItems.id, item.itemId));
  await exec
    .update(payouts)
    .set({ amountGr: sql`GREATEST(${payouts.amountGr} - ${item.amountGr}, 0)`, updatedAt: sql`now()` })
    .where(eq(payouts.id, item.payoutId));

  return { retracted: true, paidOut: false };
}
