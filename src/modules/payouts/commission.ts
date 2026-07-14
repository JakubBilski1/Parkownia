export type CommissionSplit = {
  ratePct: number;
  commissionGr: number;
  hostPayoutGr: number;
};

/**
 * Pure, and deliberately kept out of service.ts so the arithmetic that decides
 * what a host earns is testable without a database.
 *
 * The split is frozen into the booking row at purchase time (bookings.commission_*),
 * so a later rule change never rewrites settled money. Rounding goes to the
 * platform's commission and the host takes the remainder, which keeps
 * commission + payout = price exact — the database has a CHECK on it, and a
 * rounding scheme that can break it would take the whole purchase down.
 */
export function computeCommission(priceGr: number, ratePct: number): CommissionSplit {
  const commissionGr = Math.round((priceGr * ratePct) / 100);
  return { ratePct, commissionGr, hostPayoutGr: priceGr - commissionGr };
}
