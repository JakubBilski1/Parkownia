/**
 * Types for the supply-acquisition research shown at /admin/akwizycja.
 *
 * This is a RESEARCH SNAPSHOT, not transactional data, and it deliberately lives
 * in the repo rather than in Postgres. Two reasons, both from CLAUDE.md:
 *   - migrations are this project's most expensive failure mode (the
 *     `geography(Point,4326)` quoting bug held production on a stale image for
 *     five days), and there is no local PostGIS to test a new one against;
 *   - production has no such table, so a DB-backed page would ship empty.
 * The moment the admin needs to record outreach state per site ("called",
 * "refused", "signed"), that DOES need a table — see the note on the page.
 */

/**
 * What kind of owner sits behind the site. Drives the whole approach: who
 * decides, how long it takes, and what they are actually afraid of.
 */
export type Segment =
  | "DEALER"
  | "WORSHIP"
  | "INDUSTRIAL"
  | "RESIDENTIAL"
  | "OFFICE"
  | "SCHOOL"
  | "SPORTS"
  | "COMMERCIAL"
  | "HOTEL"
  | "RETAIL"
  | "HOSPITAL"
  | "PARKING_OTHER"
  | "OPERATOR";

export type VenueKey = "ENEA" | "MTP";

/** How the spot count was arrived at — printed in the UI, never hidden. */
export type SpotsBasis =
  /** OSM `capacity` tag. The only figure that is not ours. */
  | "tag"
  /** Lot polygon area / 25 m² per space. */
  | "area"
  /** Building footprint × 0.5 / 25 m² — the weakest guess of the three. */
  | "footprint";

/**
 * How confidently the lot was attributed to an owner. Only centroids and areas
 * were stored, so "inside" means the lot's centre falls within the owner's
 * equivalent-radius circle, not within its true polygon. Good enough to say
 * "this lot belongs to that school"; never used for a money figure.
 */
export type OwnerConfidence = "inside" | "adjacent" | "none";

export type CandidateSite = {
  /** OSM object id, e.g. "way/12345". Doubles as the stable row key. */
  osm: string;
  name: string | null;
  /** The feature we attributed the lot to — a school, a works, a dealership. */
  ownerName: string | null;
  ownerConfidence: OwnerConfidence;
  /** Inside Enea's or MTP's own grounds: partnership territory, not acquisition. */
  venueOwned: boolean;
  street: string | null;
  housenumber: string | null;
  segment: Segment;
  point: { lat: number; lng: number };
  /** Polygon area in m², null for point features. */
  areaM2: number | null;
  spots: number;
  spotsBasis: SpotsBasis;
  distanceEneaM: number;
  distanceMtpM: number;
  walkMinutesEnea: number;
  walkMinutesMtp: number;
  /** The nearer venue — the one the pitch leads with. */
  primaryVenue: VenueKey;
  /** Walk minutes to the primary venue. */
  walkMinutes: number;
  rateBand: string;
  /** Mid-band per-event, per-spot rate in grosze. */
  rateGr: number;
  /** Events within reach across both venues in the seeded 12-month window. */
  events: number;
  access: string | null;
  surface: string | null;
  lit: string | null;
  fee: string | null;
  /** Already charges for parking — a partnership conversation, not greenfield. */
  alreadyPaid: boolean;
  operator: string | null;
  parkingKind: string | null;
  barrier: string | null;
  supervised: string | null;
  /** OSM `maxheight`. Underground lots at 1.9 m cannot take an SUV (CLAUDE.md). */
  maxheight: string | null;
  /** spots × rateGr × events. A ceiling at full occupancy, not a forecast. */
  seasonGrossGr: number;
  /** Ranking heuristic: money on the table × segment willingness × gated × proximity. */
  score: number;
  /** How many overlapping OSM objects were folded into this row. */
  mergedFrom?: number;
};

/**
 * An owner in reach whose parking OSM does not map. Deliberately carries NO spot
 * count: the only honest capacity figure comes from a lot polygon or a `capacity`
 * tag, and this row has neither. `siteAreaM2` is the SITE, not its parking.
 */
export type ReconSite = {
  osm: string;
  name: string | null;
  street: string | null;
  housenumber: string | null;
  segment: Segment;
  point: { lat: number; lng: number };
  siteAreaM2: number;
  distanceEneaM: number;
  distanceMtpM: number;
  walkMinutesEnea: number;
  walkMinutesMtp: number;
  primaryVenue: VenueKey;
  walkMinutes: number;
  rateBand: string;
  rateGr: number;
  events: number;
};

/** A street with enough housing stock to be worth finding the administrator of. */
export type ResidentialCluster = {
  street: string;
  buildings: number;
  point: { lat: number; lng: number };
  walkMinutesEnea: number | null;
  walkMinutesMtp: number | null;
  primaryVenue: VenueKey;
  walkMinutes: number;
  rateBand: string | null;
  rateGr: number | null;
};
