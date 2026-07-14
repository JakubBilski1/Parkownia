import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, parkings } from "@/db/schema";
import { getOutstandingPayoutGr } from "./payouts";
import { dashboardSchema } from "./schemas";

/**
 * Every number here is an aggregate over real rows. Nothing is estimated,
 * extrapolated or smoothed — a dashboard that flatters us is worse than none.
 * Each metric ships with the definition the UI prints next to it.
 */

const PAID_STATUSES = sql`('CONFIRMED', 'USED')`;

const DEFAULT_WINDOW_DAYS = 30;

export type DashboardMetrics = {
  period: { from: Date; to: Date };

  /** Sum of booking prices, by booking creation date, for bookings that were paid. */
  gmvGr: number;
  txCount: number;
  avgTicketGr: number;

  /** Platform's frozen commission on those bookings. */
  commissionGr: number;
  /** Refunds actually issued in the period (by cancellation date). */
  refundedGr: number;
  /** Commission minus the platform's proportional share of those refunds. */
  netCommissionGr: number;

  /** Hosts who earned something in the period. */
  activeHosts: number;
  /** Hosts with at least one ACTIVE parking right now. */
  hostsWithActiveParkings: number;
  activeParkings: number;
  pendingReview: number;

  /** Paid ÷ started, over bookings created in the period. */
  conversion: { startedCount: number; paidCount: number; ratePct: number | null };

  outstandingPayoutGr: number;

  topParkings: {
    parkingId: string;
    title: string | null;
    txCount: number;
    gmvGr: number;
  }[];
};

export async function getDashboard(input: unknown = {}): Promise<DashboardMetrics> {
  const parsed = dashboardSchema.parse(input);
  const to = parsed.to ?? new Date();
  const from =
    parsed.from ?? new Date(to.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const inPeriod = and(gte(bookings.createdAt, from), lt(bookings.createdAt, to));

  const [sales] = await db
    .select({
      startedCount: sql<number>`count(*)::int`,
      txCount: sql<number>`count(*) FILTER (WHERE ${bookings.status} IN ${PAID_STATUSES})::int`,
      gmvGr: sql<number>`coalesce(sum(${bookings.priceGr}) FILTER (WHERE ${bookings.status} IN ${PAID_STATUSES}), 0)::int`,
      commissionGr: sql<number>`coalesce(sum(${bookings.commissionGr}) FILTER (WHERE ${bookings.status} IN ${PAID_STATUSES}), 0)::int`,
    })
    .from(bookings)
    .where(inPeriod);

  // Refunds are counted when they happened, not when the booking was made — a
  // refund in July on a June booking is a July cost.
  const [refunds] = await db
    .select({
      refundedGr: sql<number>`coalesce(sum(${bookings.refundGr}), 0)::int`,
      platformShareGr: sql<number>`coalesce(sum(
        round(
          coalesce(${bookings.refundGr}, 0)::numeric * ${bookings.commissionGr}
          / nullif(${bookings.priceGr}, 0)
        )
      ), 0)::int`,
    })
    .from(bookings)
    .where(and(gte(bookings.cancelledAt, from), lt(bookings.cancelledAt, to)));

  const [earningHosts] = await db
    .select({ value: sql<number>`count(DISTINCT ${parkings.ownerId})::int` })
    .from(bookings)
    .innerJoin(parkings, eq(parkings.id, bookings.parkingId))
    .where(and(inPeriod, sql`${bookings.status} IN ${PAID_STATUSES}`));

  const [supply] = await db
    .select({
      activeParkings: sql<number>`count(*) FILTER (WHERE ${parkings.status} = 'ACTIVE')::int`,
      pendingReview: sql<number>`count(*) FILTER (WHERE ${parkings.status} = 'PENDING_REVIEW')::int`,
      hostsWithActiveParkings: sql<number>`count(DISTINCT ${parkings.ownerId}) FILTER (WHERE ${parkings.status} = 'ACTIVE')::int`,
    })
    .from(parkings);

  const topParkings = await db
    .select({
      parkingId: parkings.id,
      title: parkings.title,
      txCount: sql<number>`count(*)::int`,
      gmvGr: sql<number>`coalesce(sum(${bookings.priceGr}), 0)::int`,
    })
    .from(bookings)
    .innerJoin(parkings, eq(parkings.id, bookings.parkingId))
    .where(and(inPeriod, sql`${bookings.status} IN ${PAID_STATUSES}`))
    .groupBy(parkings.id, parkings.title)
    .orderBy(sql`coalesce(sum(${bookings.priceGr}), 0) DESC`)
    .limit(5);

  const outstandingPayoutGr = await getOutstandingPayoutGr();

  const startedCount = sales?.startedCount ?? 0;
  const txCount = sales?.txCount ?? 0;
  const gmvGr = sales?.gmvGr ?? 0;
  const commissionGr = sales?.commissionGr ?? 0;

  return {
    period: { from, to },
    gmvGr,
    txCount,
    avgTicketGr: txCount > 0 ? Math.round(gmvGr / txCount) : 0,
    commissionGr,
    refundedGr: refunds?.refundedGr ?? 0,
    netCommissionGr: commissionGr - (refunds?.platformShareGr ?? 0),
    activeHosts: earningHosts?.value ?? 0,
    hostsWithActiveParkings: supply?.hostsWithActiveParkings ?? 0,
    activeParkings: supply?.activeParkings ?? 0,
    pendingReview: supply?.pendingReview ?? 0,
    conversion: {
      startedCount,
      paidCount: txCount,
      // Null, not 0%, when nobody tried: an empty period has no conversion rate.
      ratePct: startedCount > 0 ? Math.round((txCount / startedCount) * 100) : null,
    },
    outstandingPayoutGr,
    topParkings,
  };
}
