import { and, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { type Point, stDistance } from "@/db/geo";
import { events, leads, venues } from "@/db/schema";
import { CONSENT_VERSIONS } from "@/modules/users/consents";
import {
  COMMISSION_PCT,
  MAX_REACH_MINUTES,
  commissionPctFor,
  reachRadiusMeters,
  revenueEstimate,
  suggestedRate,
  walkMinutes,
} from "./calc";
import type { LeadInput } from "./schemas";

type VenueKey = "ENEA" | "MTP" | "OTHER";

function venueKey(name: string): VenueKey {
  if (/enea/i.test(name)) return "ENEA";
  if (/targ/i.test(name)) return "MTP";
  return "OTHER";
}

export type ReachVenue = {
  key: VenueKey;
  name: string;
  distanceMeters: number;
  walkMinutes: number;
  inReach: boolean;
};

export type EventsInReach = { total: number; football: number; tradeFair: number; other: number };

export type ReachResult = {
  point: Point;
  venues: ReachVenue[];
  nearestMinutes: number | null;
  events: EventsInReach;
  rate: ReturnType<typeof suggestedRate>;
  commissionPct: { individual: number; business: number };
  rings: { minutes: number; radiusMeters: number }[];
};

const REACH_RINGS = [5, 10, 15] as const;

/**
 * What a spot at `point` is worth in event terms, from REAL data only: PostGIS
 * distance to each venue (Enea, MTP) and a real COUNT of events in the next 12
 * months at the venues within a 15-minute walk. No hardcoded event numbers.
 */
export async function computeReach(point: Point): Promise<ReachResult> {
  const venueRows = await db
    .select({
      id: venues.id,
      name: venues.name,
      distanceMeters: stDistance(venues.location, point),
    })
    .from(venues);

  const countRows = await db
    .select({
      venueId: events.venueId,
      category: events.category,
      n: sql<number>`count(*)::int`,
    })
    .from(events)
    .where(
      and(gte(events.endsAt, sql`now()`), lte(events.startsAt, sql`now() + interval '12 months'`)),
    )
    .groupBy(events.venueId, events.category);

  const reachVenues: ReachVenue[] = venueRows.map((v) => {
    const meters = Number(v.distanceMeters);
    const minutes = walkMinutes(meters);
    return {
      key: venueKey(v.name),
      name: v.name,
      distanceMeters: Math.round(meters),
      walkMinutes: minutes,
      inReach: minutes <= MAX_REACH_MINUTES,
    };
  });

  const inReachVenueIds = new Set(
    venueRows
      .filter((v) => walkMinutes(Number(v.distanceMeters)) <= MAX_REACH_MINUTES)
      .map((v) => v.id),
  );

  const eventCounts: EventsInReach = { total: 0, football: 0, tradeFair: 0, other: 0 };
  for (const row of countRows) {
    if (!inReachVenueIds.has(row.venueId)) continue;
    const n = Number(row.n);
    eventCounts.total += n;
    if (row.category === "FOOTBALL") eventCounts.football += n;
    else if (row.category === "TRADE_FAIR") eventCounts.tradeFair += n;
    else eventCounts.other += n;
  }

  const nearest = reachVenues.reduce<number | null>(
    (min, v) => (min === null ? v.walkMinutes : Math.min(min, v.walkMinutes)),
    null,
  );

  return {
    point,
    venues: reachVenues,
    nearestMinutes: nearest,
    events: eventCounts,
    rate: nearest !== null ? suggestedRate(nearest) : null,
    commissionPct: { individual: COMMISSION_PCT.individual, business: COMMISSION_PCT.business },
    rings: REACH_RINGS.map((m) => ({ minutes: m, radiusMeters: reachRadiusMeters(m) })),
  };
}

/**
 * Persist a lead. The stored estimate is RECOMPUTED here from (point, spots,
 * ownerKind) — the numbers the browser showed are never trusted (the server owns
 * prices, per CLAUDE.md). Consent is captured with the privacy-policy version in
 * force, mirroring the consents table.
 */
export async function createLead(
  input: LeadInput,
  meta: { userAgent: string | null },
): Promise<string> {
  const point: Point | null =
    input.lat !== undefined && input.lng !== undefined
      ? { lat: input.lat, lng: input.lng }
      : null;

  let estimatedRateGr: number | null = null;
  let estimatedAnnualGrossGr: number | null = null;
  let eventsInReach: number | null = null;
  let walkMinutesEnea: number | null = null;
  let walkMinutesMtp: number | null = null;

  if (point) {
    const reach = await computeReach(point);
    eventsInReach = reach.events.total;
    walkMinutesEnea = reach.venues.find((v) => v.key === "ENEA")?.walkMinutes ?? null;
    walkMinutesMtp = reach.venues.find((v) => v.key === "MTP")?.walkMinutes ?? null;
    if (reach.rate) {
      estimatedRateGr = reach.rate.midGr;
      estimatedAnnualGrossGr = revenueEstimate({
        rateGr: reach.rate.midGr,
        spots: input.spots,
        events: reach.events.total,
        commissionPct: commissionPctFor(input.ownerKind ?? "INDIVIDUAL"),
      }).annualGrossGr;
    }
  }

  const [row] = await db
    .insert(leads)
    .values({
      objectName: input.objectName ?? null,
      address: input.address,
      ...(point ? { location: point } : {}),
      objectType: input.objectType ?? null,
      spotsDeclared: input.spots,
      contactName: input.contactName,
      phone: input.phone ?? null,
      email: input.email ?? null,
      contactPreference: input.contactPreference,
      estimatedRateGr,
      estimatedAnnualGrossGr,
      eventsInReach,
      walkMinutesEnea,
      walkMinutesMtp,
      privacyConsent: true,
      privacyConsentVersion: CONSENT_VERSIONS.PRIVACY,
      marketingEmailConsent: input.marketingEmailConsent,
      marketingPhoneConsent: input.marketingPhoneConsent,
      source: input.source ?? null,
      userAgent: meta.userAgent,
    })
    .returning({ id: leads.id });

  // The e-mail alert to kontakt@parkownia.com is deferred (it needs a pbdevs
  // template). The lead lives in the DB and will surface in the admin panel.
  // TODO(dla-wlascicieli): notify on new lead once the `owner-lead` template exists.
  return row!.id;
}
