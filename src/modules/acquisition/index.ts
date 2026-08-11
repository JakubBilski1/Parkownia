import { CANDIDATE_SITES, RECON_SITES, RESIDENTIAL_CLUSTERS } from "./dataset";
import { SEGMENT_PLAYBOOK, type Tier } from "./segments";
import type { CandidateSite, Segment, VenueKey } from "./types";

/**
 * Aggregation for /admin/akwizycja. Pure functions over the committed snapshot —
 * no database, no network. See types.ts for why the data lives in the repo.
 */

export { CANDIDATE_SITES, RECON_SITES, RESIDENTIAL_CLUSTERS, SNAPSHOT_DATE, SEARCH_RADIUS_M } from "./dataset";
export { SEGMENT_PLAYBOOK, TIER_LABEL, TIER_HINT, VENUE_LABEL } from "./segments";
export type { Tier, SegmentPlaybook } from "./segments";
export type * from "./types";

export type Totals = {
  lots: number;
  spots: number;
  /** Lots whose capacity comes from an OSM tag rather than our area estimate. */
  taggedCapacity: number;
  /** Spots on lots that already charge for parking — supply we do not need to create. */
  paidSpots: number;
  paidLots: number;
  /** Spots on lots nobody currently sells. The actual acquisition target. */
  greenfieldSpots: number;
  greenfieldLots: number;
  seasonGrossGr: number;
  reconSites: number;
  residentialStreets: number;
  residentialBuildings: number;
};

export function totals(): Totals {
  const paid = CANDIDATE_SITES.filter((s) => s.alreadyPaid);
  const green = CANDIDATE_SITES.filter((s) => !s.alreadyPaid);
  return {
    lots: CANDIDATE_SITES.length,
    spots: sumSpots(CANDIDATE_SITES),
    taggedCapacity: CANDIDATE_SITES.filter((s) => s.spotsBasis === "tag").length,
    paidSpots: sumSpots(paid),
    paidLots: paid.length,
    greenfieldSpots: sumSpots(green),
    greenfieldLots: green.length,
    seasonGrossGr: green.reduce((n, s) => n + s.seasonGrossGr, 0),
    reconSites: RECON_SITES.length,
    residentialStreets: RESIDENTIAL_CLUSTERS.length,
    residentialBuildings: RESIDENTIAL_CLUSTERS.reduce((n, r) => n + r.buildings, 0),
  };
}

function sumSpots(rows: readonly CandidateSite[]): number {
  return rows.reduce((n, s) => n + s.spots, 0);
}

export type VenueSplit = {
  venue: VenueKey;
  lots: number;
  spots: number;
  greenfieldSpots: number;
  events: number;
};

/** A lot can be in reach of both venues, so these two rows may overlap. */
export function byVenue(): VenueSplit[] {
  return (["ENEA", "MTP"] as const).map((venue) => {
    const inReach = CANDIDATE_SITES.filter(
      (s) => (venue === "ENEA" ? s.walkMinutesEnea : s.walkMinutesMtp) <= 15,
    );
    return {
      venue,
      lots: inReach.length,
      spots: sumSpots(inReach),
      greenfieldSpots: sumSpots(inReach.filter((s) => !s.alreadyPaid)),
      events: venue === "ENEA" ? 9 : 8,
    };
  });
}

export type SegmentSummary = {
  segment: Segment;
  tier: Tier;
  lots: number;
  spots: number;
  greenfieldSpots: number;
  reconSites: number;
  seasonGrossGr: number;
};

export function bySegment(): SegmentSummary[] {
  const segments = new Set<Segment>([
    ...CANDIDATE_SITES.map((s) => s.segment),
    ...RECON_SITES.map((s) => s.segment),
  ]);

  return [...segments]
    .map((segment) => {
      const rows = CANDIDATE_SITES.filter((s) => s.segment === segment);
      const green = rows.filter((s) => !s.alreadyPaid);
      return {
        segment,
        tier: SEGMENT_PLAYBOOK[segment].tier,
        lots: rows.length,
        spots: sumSpots(rows),
        greenfieldSpots: sumSpots(green),
        reconSites: RECON_SITES.filter((s) => s.segment === segment).length,
        seasonGrossGr: green.reduce((n, s) => n + s.seasonGrossGr, 0),
      };
    })
    .sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || b.greenfieldSpots - a.greenfieldSpots);
}

const tierRank = (t: Tier) => (t === "A" ? 0 : t === "B" ? 1 : 2);

export type Filters = {
  segment?: string;
  venue?: string;
  tier?: string;
  /** "green" hides lots that already sell parking. */
  supply?: string;
  q?: string;
};

/** Server-side filtering for the table. Sorted by score, best first. */
export function filterSites(filters: Filters): CandidateSite[] {
  const q = filters.q?.trim().toLowerCase();

  return CANDIDATE_SITES.filter((s) => {
    if (filters.segment && s.segment !== filters.segment) return false;
    if (filters.tier && SEGMENT_PLAYBOOK[s.segment].tier !== filters.tier) return false;
    if (filters.supply === "green" && s.alreadyPaid) return false;
    if (filters.supply === "paid" && !s.alreadyPaid) return false;
    if (filters.venue === "ENEA" && s.walkMinutesEnea > 15) return false;
    if (filters.venue === "MTP" && s.walkMinutesMtp > 15) return false;
    if (q) {
      const haystack = [s.name, s.ownerName, s.street, s.operator, s.osm]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/** Human label for the address, falling back through what OSM gave us. */
export function addressOf(s: {
  street: string | null;
  housenumber: string | null;
  osm: string;
}): string {
  if (s.street && s.housenumber) return `${s.street} ${s.housenumber}`;
  if (s.street) return s.street;
  return "bez adresu w OSM";
}

/** Deep link to the object on osm.org so a claim can be checked in one click. */
export function osmUrl(osm: string): string {
  const [type, id] = osm.split("/");
  return `https://www.openstreetmap.org/${type}/${id}`;
}

/** Google Maps satellite view — the fastest way to see whether a lot is fenced. */
export function satelliteUrl(point: { lat: number; lng: number }): string {
  return `https://www.google.com/maps/@${point.lat},${point.lng},19z/data=!3m1!1e3`;
}
