import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { eventParkingAvailability, parkings } from "@/db/schema";
import type { EventCategory } from "@/db/types";
import { estimateWalk } from "@/lib/format";
import { eventSlug } from "./slug";

/**
 * Fallback when a host has never priced an event slot: the e-mail still has to
 * offer a concrete "Tak, N miejsc po X zł", and an empty price would kill the
 * one-click path. 30 zł is the seed baseline around Enea Stadion.
 */
export const DEFAULT_EVENT_PRICE_GR = 3000;

export type HostEventParking = {
  parkingId: string;
  parkingTitle: string | null;
  capacity: number | null;
  straightLineMeters: number;
  walkMeters: number;
  walkMinutes: number;
  /** Null = the host has not answered for this event yet. */
  isAvailable: boolean | null;
  declaredSpots: number | null;
  declaredPriceGr: number | null;
  notes: string | null;
  /** What the toggle proposes when it is switched on. Server-computed. */
  suggestedSpots: number;
  suggestedPriceGr: number;
};

export type HostEvent = {
  id: string;
  slug: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  category: EventCategory;
  venueName: string;
  parkings: HostEventParking[];
};

type HostEventRow = {
  event_id: string;
  title: string;
  starts_at: Date;
  ends_at: Date;
  category: EventCategory;
  venue_name: string;
  parking_id: string;
  parking_title: string | null;
  capacity: number | null;
  price_per_event_gr: number | null;
  price_per_day_gr: number | null;
  straight_meters: number;
  is_available: boolean | null;
  declared_spots: number | null;
  declared_price_gr: number | null;
  notes: string | null;
};

export function suggestSpots(capacity: number | null, declared: number | null): number {
  return declared ?? capacity ?? 1;
}

export function suggestPriceGr(
  declaredPriceGr: number | null,
  pricePerEventGr: number | null,
  pricePerDayGr: number | null,
): number {
  return declaredPriceGr ?? pricePerEventGr ?? pricePerDayGr ?? DEFAULT_EVENT_PRICE_GR;
}

/**
 * Upcoming events within the search radius of any of this host's ACTIVE parkings,
 * with the answer given so far. PAUSED parkings are left out on purpose: a
 * declaration on a parking that is out of sale would show a toggle that changes
 * nothing a driver can see.
 */
export async function listHostEvents(hostId: string): Promise<HostEvent[]> {
  const rows = await db.execute<HostEventRow>(sql`
    SELECT
      e.id AS event_id,
      e.title,
      e.starts_at,
      e.ends_at,
      e.category,
      v.name AS venue_name,
      p.id AS parking_id,
      p.title AS parking_title,
      p.capacity,
      p.price_per_event_gr,
      p.price_per_day_gr,
      ST_Distance(p.location, v.location)::float8 AS straight_meters,
      epa.is_available,
      epa.spots AS declared_spots,
      epa.price_gr AS declared_price_gr,
      epa.notes
    FROM events e
    JOIN venues v ON v.id = e.venue_id
    JOIN parkings p
      ON p.owner_id = ${hostId}
     AND p.status = 'ACTIVE'
     AND ST_DWithin(p.location, v.location, e.search_radius_meters)
    LEFT JOIN event_parking_availability epa
      ON epa.event_id = e.id AND epa.parking_id = p.id
    WHERE e.ends_at >= now()
    ORDER BY e.starts_at ASC, straight_meters ASC
  `);

  const byEvent = new Map<string, HostEvent>();

  for (const row of rows) {
    let event = byEvent.get(row.event_id);
    if (!event) {
      event = {
        id: row.event_id,
        slug: eventSlug({ id: row.event_id, title: row.title, startsAt: row.starts_at }),
        title: row.title,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        category: row.category,
        venueName: row.venue_name,
        parkings: [],
      };
      byEvent.set(row.event_id, event);
    }

    const walk = estimateWalk(row.straight_meters);
    event.parkings.push({
      parkingId: row.parking_id,
      parkingTitle: row.parking_title,
      capacity: row.capacity,
      straightLineMeters: Math.round(row.straight_meters),
      walkMeters: walk.meters,
      walkMinutes: walk.minutes,
      isAvailable: row.is_available,
      declaredSpots: row.declared_spots,
      declaredPriceGr: row.declared_price_gr,
      notes: row.notes,
      suggestedSpots: suggestSpots(row.capacity, row.declared_spots),
      suggestedPriceGr: suggestPriceGr(
        row.declared_price_gr,
        row.price_per_event_gr,
        row.price_per_day_gr,
      ),
    });
  }

  return [...byEvent.values()];
}

export type DeclareResult =
  | { ok: true; isAvailable: boolean; spots: number | null; priceGr: number | null }
  | { ok: false; reason: "PARKING_NOT_OWNED" };

/**
 * Upsert on the (event_id, parking_id) primary key: a host who taps the toggle
 * twice ends with one row, and the e-mail path and the panel write the same row.
 * Ownership is re-checked here, never trusted from the request.
 */
export async function declareAvailability(input: {
  hostId: string;
  eventId: string;
  parkingId: string;
  isAvailable: boolean;
  spots: number | null;
  priceGr: number | null;
  notes?: string | null;
}): Promise<DeclareResult> {
  const [owned] = await db
    .select({ id: parkings.id })
    .from(parkings)
    .where(and(eq(parkings.id, input.parkingId), eq(parkings.ownerId, input.hostId)))
    .limit(1);

  if (!owned) {
    return { ok: false, reason: "PARKING_NOT_OWNED" };
  }

  const [row] = await db
    .insert(eventParkingAvailability)
    .values({
      eventId: input.eventId,
      parkingId: input.parkingId,
      isAvailable: input.isAvailable,
      spots: input.spots,
      priceGr: input.priceGr,
      notes: input.notes ?? null,
      declaredAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [eventParkingAvailability.eventId, eventParkingAvailability.parkingId],
      set: {
        isAvailable: input.isAvailable,
        spots: input.spots,
        priceGr: input.priceGr,
        notes: input.notes ?? null,
        declaredAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning({
      isAvailable: eventParkingAvailability.isAvailable,
      spots: eventParkingAvailability.spots,
      priceGr: eventParkingAvailability.priceGr,
    });

  return {
    ok: true,
    isAvailable: row?.isAvailable ?? input.isAvailable,
    spots: row?.spots ?? input.spots,
    priceGr: row?.priceGr ?? input.priceGr,
  };
}
