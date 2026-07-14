import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bookings, eventParkingAvailability, events, parkings, venues } from "@/db/schema";
import type { ManifestEntry, ManifestParking, ScanManifest } from "./types";

/**
 * The offline package, pulled BEFORE the event while there is still network.
 * It carries `code_hash`, never `code` — a phone lost at the stadium must not
 * be a ticket printer. It also carries no personal data (no plate, no name,
 * no e-mail): IndexedDB on a host's private phone is not a place for PII.
 */
export async function buildScanManifest(
  hostId: string,
  eventId: string,
): Promise<ScanManifest | null> {
  const [event] = await db
    .select({
      id: events.id,
      title: events.title,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      venueName: venues.name,
    })
    .from(events)
    .innerJoin(venues, eq(venues.id, events.venueId))
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) return null;

  const ownedParkings = await db
    .select({ id: parkings.id, title: parkings.title, address: parkings.address })
    .from(parkings)
    .where(eq(parkings.ownerId, hostId));

  if (ownedParkings.length === 0) {
    return emptyManifest(event);
  }

  const ownedIds = ownedParkings.map((parking) => parking.id);

  const declared = await db
    .select({ parkingId: eventParkingAvailability.parkingId })
    .from(eventParkingAvailability)
    .where(
      and(
        eq(eventParkingAvailability.eventId, eventId),
        eq(eventParkingAvailability.isAvailable, true),
        inArray(eventParkingAvailability.parkingId, ownedIds),
      ),
    );

  const rows = await db
    .select({
      codeHash: bookings.codeHash,
      parkingId: bookings.parkingId,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      spots: bookings.spots,
      status: bookings.status,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.eventId, eventId),
        inArray(bookings.parkingId, ownedIds),
        inArray(bookings.status, ["CONFIRMED", "USED"]),
      ),
    );

  const entries: ManifestEntry[] = rows.map((row) => ({
    codeHash: row.codeHash,
    parkingId: row.parkingId,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    spots: row.spots,
    status: row.status === "USED" ? "USED" : "CONFIRMED",
  }));

  // A gate the host must staff is one they declared for the event, or one that
  // already sold a booking for it. Both, because a declaration can be withdrawn
  // after somebody has paid — and that car will still turn up.
  const relevantIds = new Set<string>([
    ...declared.map((row) => row.parkingId),
    ...entries.map((entry) => entry.parkingId),
  ]);

  const manifestParkings: ManifestParking[] = ownedParkings
    .filter((parking) => relevantIds.has(parking.id))
    .map((parking) => ({
      id: parking.id,
      title: parking.title ?? parking.address ?? "Parking bez nazwy",
    }));

  return {
    eventId: event.id,
    eventTitle: `${event.title} · ${event.venueName}`,
    eventStartsAt: event.startsAt.toISOString(),
    eventEndsAt: event.endsAt.toISOString(),
    generatedAt: new Date().toISOString(),
    parkings: manifestParkings,
    entries,
  };
}

function emptyManifest(event: {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  venueName: string;
}): ScanManifest {
  return {
    eventId: event.id,
    eventTitle: `${event.title} · ${event.venueName}`,
    eventStartsAt: event.startsAt.toISOString(),
    eventEndsAt: event.endsAt.toISOString(),
    generatedAt: new Date().toISOString(),
    parkings: [],
    entries: [],
  };
}

export type HostEventSummary = {
  eventId: string;
  title: string;
  startsAt: string;
  endsAt: string;
};

/** Upcoming events the host has a gate at — the list the scanner offers to download. */
export async function listHostScanEvents(hostId: string): Promise<HostEventSummary[]> {
  const rows = await db
    .select({
      eventId: events.id,
      title: events.title,
      venueName: venues.name,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      parkingId: eventParkingAvailability.parkingId,
    })
    .from(eventParkingAvailability)
    .innerJoin(events, eq(events.id, eventParkingAvailability.eventId))
    .innerJoin(venues, eq(venues.id, events.venueId))
    .innerJoin(parkings, eq(parkings.id, eventParkingAvailability.parkingId))
    .where(
      and(
        eq(parkings.ownerId, hostId),
        eq(eventParkingAvailability.isAvailable, true),
        // Yesterday's match is not something anyone needs to download codes for.
        gte(events.endsAt, new Date()),
      ),
    )
    .orderBy(events.startsAt);

  const byEvent = new Map<string, HostEventSummary>();
  for (const row of rows) {
    if (byEvent.has(row.eventId)) continue;
    byEvent.set(row.eventId, {
      eventId: row.eventId,
      title: `${row.title} · ${row.venueName}`,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
    });
  }

  return [...byEvent.values()];
}
