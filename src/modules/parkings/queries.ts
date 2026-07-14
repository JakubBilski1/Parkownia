import { and, desc, eq, gte, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { stDistance, stDWithin, stIntersectsEnvelope, type BoundingBox, type Point } from "@/db/geo";
import { parkings } from "@/db/schema";
import type { OwnerType } from "@/db/types";
import { isAvailableSql } from "./availability";
import type { ParkingFilters } from "./schemas";

/**
 * Every geographic predicate below is PostGIS on the GiST index. Fetching rows and
 * filtering them in JavaScript would survive 500 parkings and die at 5000, and the
 * map fires one of these on every pan (CLAUDE.md, docs/ARCHITECTURE.md §3).
 */

/** A pin is 60 px wide. It carries what fits on it and nothing else. */
export const MAP_PIN_LIMIT = 500;

export type PriceUnit = "HOUR" | "DAY" | "EVENT";

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  priceGr: number;
  priceUnit: PriceUnit;
  ownerType: OwnerType;
  isCovered: boolean | null;
};

export type NearbyPin = MapPin & {
  /** Straight-line metres from PostGIS. The UI must hedge it — src/lib/format.ts. */
  straightLineMeters: number;
  title: string | null;
};

const lat = sql<number>`ST_Y(${parkings.location}::geometry)`;
const lng = sql<number>`ST_X(${parkings.location}::geometry)`;

// "From" price: the cheapest way in. Hourly first because that is how a driver
// reads a map pin; the unit travels with the number so 35 zł is never ambiguous.
const priceGr = sql<number>`COALESCE(
  ${parkings.pricePerHourGr},
  ${parkings.pricePerEventGr},
  ${parkings.pricePerDayGr}
)`;

const priceUnit = sql<PriceUnit>`CASE
  WHEN ${parkings.pricePerHourGr} IS NOT NULL THEN 'HOUR'
  WHEN ${parkings.pricePerEventGr} IS NOT NULL THEN 'EVENT'
  ELSE 'DAY'
END`;

const pinColumns = {
  id: parkings.id,
  lat,
  lng,
  priceGr,
  priceUnit,
  ownerType: parkings.ownerType,
  isCovered: parkings.isCovered,
};

function filterConditions(filters: ParkingFilters): SQL[] {
  const conditions: SQL[] = [
    eq(parkings.status, "ACTIVE"),
    sql`${priceGr} IS NOT NULL`,
  ];

  if (filters.maxPriceGr !== undefined) {
    conditions.push(sql`${priceGr} <= ${filters.maxPriceGr}`);
  }

  if (filters.parkingType?.length) {
    conditions.push(inArray(parkings.parkingType, filters.parkingType));
  }

  if (filters.accessType?.length) {
    conditions.push(inArray(parkings.accessType, filters.accessType));
  }

  if (filters.isCovered !== undefined) {
    conditions.push(eq(parkings.isCovered, filters.isCovered));
  }

  if (filters.isGuarded !== undefined) {
    conditions.push(eq(parkings.isGuarded, filters.isGuarded));
  }

  if (filters.minHeightCm !== undefined) {
    // A parking that never declared a clearance is an open lot in practice; one
    // that declared 190 cm is hidden from a 210 cm SUV rather than sold to it and
    // explained at the barrier.
    const height = or(
      isNull(parkings.maxVehicleHeightCm),
      gte(parkings.maxVehicleHeightCm, filters.minHeightCm),
    );
    if (height) conditions.push(height);
  }

  if (filters.availableFrom && filters.availableTo) {
    conditions.push(
      isAvailableSql({
        from: filters.availableFrom,
        to: filters.availableTo,
        spots: filters.spots,
      }),
    );
  } else {
    conditions.push(gte(parkings.capacity, filters.spots));
  }

  return conditions;
}

export async function findParkingsInBbox(
  bbox: BoundingBox,
  filters: ParkingFilters,
): Promise<MapPin[]> {
  const rows = await db
    .select(pinColumns)
    .from(parkings)
    .where(
      and(stIntersectsEnvelope(parkings.location, bbox), ...filterConditions(filters)),
    )
    // Capped, not paginated: past 500 pins the map is a smear anyway, and the
    // client clusters. A complete parking outranks an abandoned draft-grade one.
    .orderBy(desc(parkings.profileCompleteness), parkings.id)
    .limit(MAP_PIN_LIMIT);

  return rows.map((row) => ({ ...row, isCovered: row.isCovered ?? null }));
}

export async function findParkingsNearby(
  point: Point,
  radiusMeters: number,
  limit: number,
  filters: ParkingFilters,
): Promise<NearbyPin[]> {
  const distance = stDistance(parkings.location, point);

  const rows = await db
    .select({ ...pinColumns, title: parkings.title, straightLineMeters: distance })
    .from(parkings)
    .where(
      and(stDWithin(parkings.location, point, radiusMeters), ...filterConditions(filters)),
    )
    .orderBy(distance)
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    isCovered: row.isCovered ?? null,
    straightLineMeters: Math.round(Number(row.straightLineMeters)),
  }));
}

/**
 * Straight-line metres from a parking to a point, for the parking card. The caller
 * turns it into "ok. 850 m pieszo" (× 1.3) — this number is never shown raw.
 */
export async function straightLineDistanceTo(
  parkingId: string,
  point: Point,
): Promise<number | null> {
  const [row] = await db
    .select({ meters: stDistance(parkings.location, point) })
    .from(parkings)
    .where(eq(parkings.id, parkingId))
    .limit(1);

  return row ? Math.round(Number(row.meters)) : null;
}
