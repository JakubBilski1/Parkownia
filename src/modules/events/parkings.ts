import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { stDistance, stDWithin, type Point } from "@/db/geo";
import { eventParkingAvailability, parkings } from "@/db/schema";
import type { OwnerType, ParkingType } from "@/db/types";
import { estimateWalk } from "@/lib/format";
import {
  freeSpotsSql,
  modeCoversWindowSql,
  notBlackedOutSql,
  type Window,
} from "@/modules/parkings/availability";
import { eventBookingWindow } from "@/modules/parkings/pricing";
import { getEventById } from "./service";

export type EventParking = {
  id: string;
  title: string | null;
  address: string | null;
  parkingType: ParkingType | null;
  ownerType: OwnerType;
  location: Point;
  entranceLocation: Point | null;
  entranceNotes: string | null;
  isCovered: boolean | null;
  isGuarded: boolean | null;
  maxVehicleHeightCm: number | null;
  /** Event price: the host's declaration first, then the parking's own event price. */
  priceGr: number;
  freeSpots: number;
  /** Straight line to the venue. Never shown without the "ok." hedge. */
  straightLineMeters: number;
  walkMeters: number;
  walkMinutes: number;
  declaredByHost: boolean;
  hostNotes: string | null;
};

/**
 * Parkings inside the event's search radius that can actually be sold for it,
 * nearest first. Every predicate runs in PostGIS/SQL — nothing is filtered in JS.
 *
 * The booked window is the event plus the arrival/exit buffer
 * (src/modules/parkings/pricing.ts), so availability is checked against the window
 * the driver will really occupy, not against the referee's clock.
 *
 * Who shows up:
 *  - the host declared this parking for this event → yes, at the declared price and spots;
 *  - the host declared "nie tym razem"             → no, whatever the schedule says;
 *  - no declaration                                → only if the parking's own availability
 *    mode covers the whole window (ALWAYS / MANUAL windows / weekly schedule).
 * An explicit "tak" beats the schedule: it is the newer, more specific decision.
 * A parking with no event price (own or declared) cannot be quoted, so it is not listed.
 */
export async function listEventParkings(eventId: string): Promise<EventParking[]> {
  const event = await getEventById(eventId);
  if (!event) return [];

  const window: Window = eventBookingWindow(event);
  const priceGr = sql<number>`COALESCE(${eventParkingAvailability.priceGr}, ${parkings.pricePerEventGr})`;
  const distance = stDistance(parkings.location, event.venue.location);
  const declared = eq(eventParkingAvailability.isAvailable, true);

  const rows = await db
    .select({
      id: parkings.id,
      title: parkings.title,
      address: parkings.address,
      parkingType: parkings.parkingType,
      ownerType: parkings.ownerType,
      location: parkings.location,
      entranceLocation: parkings.entranceLocation,
      entranceNotes: parkings.entranceNotes,
      isCovered: parkings.isCovered,
      isGuarded: parkings.isGuarded,
      maxVehicleHeightCm: parkings.maxVehicleHeightCm,
      priceGr,
      freeSpots: freeSpotsSql(window, event.id),
      straightLineMeters: distance,
      declaredByHost: sql<boolean>`${eventParkingAvailability.parkingId} IS NOT NULL`,
      hostNotes: eventParkingAvailability.notes,
    })
    .from(parkings)
    .leftJoin(
      eventParkingAvailability,
      and(
        eq(eventParkingAvailability.parkingId, parkings.id),
        eq(eventParkingAvailability.eventId, event.id),
      ),
    )
    .where(
      and(
        eq(parkings.status, "ACTIVE"),
        stDWithin(parkings.location, event.venue.location, event.searchRadiusMeters),
        or(isNull(eventParkingAvailability.parkingId), declared),
        or(declared, modeCoversWindowSql(window)),
        notBlackedOutSql(window),
        sql`${priceGr} IS NOT NULL`,
        sql`${freeSpotsSql(window, event.id)} >= 1`,
      ),
    )
    .orderBy(asc(distance));

  return rows.map((row) => {
    const straightLineMeters = Math.round(Number(row.straightLineMeters));
    const walk = estimateWalk(straightLineMeters);

    return {
      id: row.id,
      title: row.title,
      address: row.address,
      parkingType: row.parkingType,
      ownerType: row.ownerType,
      location: row.location as Point,
      entranceLocation: row.entranceLocation,
      entranceNotes: row.entranceNotes,
      isCovered: row.isCovered,
      isGuarded: row.isGuarded,
      maxVehicleHeightCm: row.maxVehicleHeightCm,
      priceGr: Number(row.priceGr),
      freeSpots: Number(row.freeSpots),
      straightLineMeters,
      walkMeters: walk.meters,
      walkMinutes: walk.minutes,
      declaredByHost: row.declaredByHost,
      hostNotes: row.hostNotes,
    } satisfies EventParking;
  });
}
