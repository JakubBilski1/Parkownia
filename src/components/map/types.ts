import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Map pins — GET /api/map/parkings?bbox=…  (docs/API_SPEC.md §3)              */
/* -------------------------------------------------------------------------- */

/**
 * The endpoint is deliberately thin: 500 pins have to travel over a phone
 * network under a stadium. Anything the pin does not draw is not requested.
 */
export const mapPinSchema = z.object({
  id: z.string(),
  lat: z.number(),
  lng: z.number(),
  priceGr: z.int(),
  ownerType: z.enum(["INDIVIDUAL", "BUSINESS"]),
  isCovered: z.boolean().nullable().default(false),
  /**
   * Straight-line metres from the reference point (event venue), when the
   * server knows it. Absent on a plain viewport fetch — the client then falls
   * back to its own approximation and labels it as such.
   */
  walkMeters: z.number().nullable().optional(),
});

export const mapPinsResponseSchema = z.object({
  items: z.array(mapPinSchema),
});

export type MapPin = z.infer<typeof mapPinSchema>;

/* -------------------------------------------------------------------------- */
/* Parking detail — GET /api/parkings/:id                                      */
/* -------------------------------------------------------------------------- */

export const parkingPhotoSchema = z.object({
  url: z.string(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
});

export const parkingDetailSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable().optional(),
  address: z.string().nullable(),
  ownerType: z.enum(["INDIVIDUAL", "BUSINESS"]),
  parkingType: z
    .enum([
      "OUTDOOR_LOT",
      "UNDERGROUND",
      "GARAGE",
      "DRIVEWAY",
      "STREET_ADJACENT",
      "MULTI_STOREY",
    ])
    .nullable()
    .optional(),
  accessType: z
    .enum([
      "OPEN",
      "BARRIER_CODE",
      "BARRIER_REMOTE",
      "GATE_MANUAL",
      "LPR",
      "KEY_HANDOVER",
      "ATTENDANT",
    ])
    .nullable()
    .optional(),
  isCovered: z.boolean().nullable().optional(),
  isGuarded: z.boolean().nullable().optional(),
  hasCctv: z.boolean().nullable().optional(),
  isLit: z.boolean().nullable().optional(),
  hasEvCharging: z.boolean().nullable().optional(),
  hasDisabledAccess: z.boolean().nullable().optional(),
  maxVehicleHeightCm: z.number().nullable().optional(),
  capacity: z.number().nullable().optional(),
  entranceNotes: z.string().nullable().optional(),
  photos: z.array(parkingPhotoSchema).default([]),
  priceGr: z.int().nullable(),
  /** What the price buys: "za mecz", "za godzinę". Server-side wording. */
  priceUnit: z.string().nullable().optional(),
  /** Server-side estimate. isApproximate is never assumed to be false. */
  distanceMeters: z.number().nullable().optional(),
  isApproximate: z.boolean().optional(),
});

export type ParkingDetail = z.infer<typeof parkingDetailSchema>;

/* -------------------------------------------------------------------------- */
/* Events — GET /api/events?upcoming=true                                      */
/* -------------------------------------------------------------------------- */

export const mapEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  startsAt: z.string(),
  endsAt: z.string().optional(),
  searchRadiusMeters: z.number().default(1500),
  venue: z.object({
    name: z.string(),
    lat: z.number(),
    lng: z.number(),
  }),
});

export const mapEventsResponseSchema = z.object({
  items: z.array(mapEventSchema),
});

export type MapEvent = z.infer<typeof mapEventSchema>;

/* -------------------------------------------------------------------------- */
/* Active booking — GET /api/bookings/mine (active one first)                  */
/* -------------------------------------------------------------------------- */

export const activeBookingSchema = z.object({
  id: z.string(),
  code: z.string().nullable(),
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "EXPIRED", "USED", "NO_SHOW"]),
  startsAt: z.string(),
  endsAt: z.string(),
  spots: z.number().default(1),
  parking: z.object({
    id: z.string(),
    title: z.string().nullable(),
    address: z.string().nullable(),
  }),
});

export const bookingsResponseSchema = z.object({
  items: z.array(activeBookingSchema),
});

export type ActiveBooking = z.infer<typeof activeBookingSchema>;

/* -------------------------------------------------------------------------- */
/* Viewport and filters                                                        */
/* -------------------------------------------------------------------------- */

export type Bbox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type LngLat = { lng: number; lat: number };

export type ParkingTypeFilter = NonNullable<ParkingDetail["parkingType"]>;

export type MapFilters = {
  /** Cap in grosze. Set by the driver, enforced by the server query. */
  maxPriceGr: number | null;
  isCovered: boolean;
  isGuarded: boolean;
  /** Vehicle height in centimetres — a 2,10 m SUV must never see a 1,90 m garage. */
  minHeightCm: number | null;
  parkingType: ParkingTypeFilter[];
  hasEvCharging: boolean;
  hasDisabledAccess: boolean;
};

export const EMPTY_FILTERS: MapFilters = {
  maxPriceGr: null,
  isCovered: false,
  isGuarded: false,
  minHeightCm: null,
  parkingType: [],
  hasEvCharging: false,
  hasDisabledAccess: false,
};

export function countActiveFilters(filters: MapFilters): number {
  let count = 0;
  if (filters.maxPriceGr !== null) count += 1;
  if (filters.isCovered) count += 1;
  if (filters.isGuarded) count += 1;
  if (filters.minHeightCm !== null) count += 1;
  if (filters.parkingType.length > 0) count += 1;
  if (filters.hasEvCharging) count += 1;
  if (filters.hasDisabledAccess) count += 1;
  return count;
}

export function filtersToQuery(filters: MapFilters): Record<string, string> {
  const query: Record<string, string> = {};
  if (filters.maxPriceGr !== null) query.maxPriceGr = String(filters.maxPriceGr);
  if (filters.isCovered) query.isCovered = "true";
  if (filters.isGuarded) query.isGuarded = "true";
  if (filters.minHeightCm !== null) query.minHeightCm = String(filters.minHeightCm);
  if (filters.parkingType.length > 0) query.parkingType = filters.parkingType.join(",");
  if (filters.hasEvCharging) query.hasEvCharging = "true";
  if (filters.hasDisabledAccess) query.hasDisabledAccess = "true";
  return query;
}
