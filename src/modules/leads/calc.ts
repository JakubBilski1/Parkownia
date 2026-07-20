import { WALK_DETOUR_FACTOR, WALK_SPEED_M_PER_MIN, estimateWalk } from "@/lib/format";

/**
 * Revenue model for the acquisition calculator on /dla-wlascicieli. Every number
 * here is an OPENLY-STATED ASSUMPTION ("szacunek"), never a promise:
 *   - the per-event rate bands are the agreed widełki, tuned by walking zone;
 *   - the walk model is the app's single one (estimateWalk in @/lib/format:
 *     80 m/min, ×1.3 detour), so the calculator never disagrees with the event
 *     pages, and every distance stays a hedged straight line, not a routed path;
 *   - the commission mirrors commission_rules GLOBAL_* (50% individual / 30%
 *     business), which is the source of truth at booking time.
 * Money is grosze (integer), like everywhere else in the database.
 */

/** Farthest a spot can be from a venue and still count as "in reach". */
export const MAX_REACH_MINUTES = 15;

/** Mirrors commission_rules GLOBAL_INDIVIDUAL / GLOBAL_BUSINESS. Display only. */
export const COMMISSION_PCT = { individual: 50, business: 30 } as const;

export type OwnerKind = "INDIVIDUAL" | "BUSINESS";

export function commissionPctFor(owner: OwnerKind): number {
  return owner === "BUSINESS" ? COMMISSION_PCT.business : COMMISSION_PCT.individual;
}

type RateBand = { maxMinutes: number; band: string; minGr: number; midGr: number; maxGr: number };

// Closer to the gate = scarcer = dearer. These ranges are the agreed assumption;
// the owner can override the rate by hand in the UI.
const RATE_BANDS: readonly RateBand[] = [
  { maxMinutes: 5, band: "0–5 min", minGr: 4000, midGr: 5500, maxGr: 7000 },
  { maxMinutes: 10, band: "5–10 min", minGr: 3000, midGr: 4000, maxGr: 5000 },
  { maxMinutes: 15, band: "10–15 min", minGr: 2000, midGr: 2750, maxGr: 3500 },
];

export type RateSuggestion = { band: string; minGr: number; midGr: number; maxGr: number };

/** Suggested per-event, per-spot price band for a spot `minutes` from the venue. */
export function suggestedRate(minutes: number): RateSuggestion | null {
  const found = RATE_BANDS.find((b) => minutes <= b.maxMinutes);
  if (!found) return null;
  return { band: found.band, minGr: found.minGr, midGr: found.midGr, maxGr: found.maxGr };
}

export type RevenueEstimate = {
  perEventGrossGr: number;
  annualGrossGr: number;
  commissionGr: number;
  annualNetGr: number;
};

/**
 * Gross = what drivers pay in total; commission is Parkownia's cut, shown apart;
 * net is what the owner keeps. Full occupancy is assumed — this is a ceiling, not
 * a forecast, and the UI says so.
 */
export function revenueEstimate(args: {
  rateGr: number;
  spots: number;
  events: number;
  commissionPct: number;
}): RevenueEstimate {
  const perEventGrossGr = Math.round(args.rateGr) * args.spots;
  const annualGrossGr = perEventGrossGr * args.events;
  const commissionGr = Math.round((annualGrossGr * args.commissionPct) / 100);
  return {
    perEventGrossGr,
    annualGrossGr,
    commissionGr,
    annualNetGr: annualGrossGr - commissionGr,
  };
}

/** Straight-line minutes under the app's walk model — reused, never re-invented. */
export function walkMinutes(straightLineMeters: number): number {
  return estimateWalk(straightLineMeters).minutes;
}

/**
 * Straight-line radius of the "N-minute walk" ring the mini-map draws. It inverts
 * estimateWalk (minutes = meters·detour / speed), so the rings and the per-point
 * minutes agree at each boundary. These are decoration for a euclidean ring — NOT
 * a real isochrone (real pedestrian routing is out of MVP scope).
 */
export function reachRadiusMeters(minutes: number): number {
  return Math.round((minutes * WALK_SPEED_M_PER_MIN) / WALK_DETOUR_FACTOR);
}
