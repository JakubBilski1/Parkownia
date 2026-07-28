// Client-side mirrors of the /potencjal + /geocode JSON shapes. Kept here (not
// imported from the server module) so no server-only code crosses into the bundle.

export type GeocodeItem = {
  label: string;
  lat: number;
  lng: number;
  city: string | null;
  postcode: string | null;
};

/** A landmark on the map before anything has been picked — no distances yet. */
export type VenueAnchor = {
  key: "ENEA" | "MTP" | "OTHER";
  name: string;
  lat: number;
  lng: number;
};

export type ReachVenue = {
  key: "ENEA" | "MTP" | "OTHER";
  name: string;
  lat: number;
  lng: number;
  distanceMeters: number;
  walkMinutes: number;
  inReach: boolean;
};

export type ReachRing = { minutes: number; radiusMeters: number };

export type ReachData = {
  point: { lat: number; lng: number };
  venues: ReachVenue[];
  nearestMinutes: number | null;
  events: { total: number; football: number; tradeFair: number; other: number };
  rate: { band: string; minGr: number; midGr: number; maxGr: number } | null;
  commissionPct: { individual: number; business: number };
  rings: ReachRing[];
};

export type OwnerKind = "INDIVIDUAL" | "BUSINESS";
export type ObjectType = "LOT" | "DRIVEWAY" | "COMPANY_LOT" | "GARAGE" | "OTHER";
export type ContactPreference = "PHONE" | "EMAIL";
