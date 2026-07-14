import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, eventParkingAvailability, events, venues } from "@/db/schema";
import { tstz } from "@/db/time";
import { AdminError, notFound } from "./errors";
import { decodeCursor, toPage, type Page } from "./pagination";
import { createEventSchema, eventListSchema, updateEventSchema } from "./schemas";

export type AdminEventRow = {
  id: string;
  createdAt: Date;
  title: string;
  startsAt: Date;
  endsAt: Date;
  category: (typeof events.$inferSelect)["category"];
  expectedAttendance: number | null;
  searchRadiusMeters: number;
  venueId: string;
  venueName: string;
  /** How many hosts said yes — the supply side of this event, straight from the table. */
  declaredParkings: number;
  declaredSpots: number;
  bookingCount: number;
};

const declaredParkingsSql = sql<number>`(
  SELECT count(*)::int FROM ${eventParkingAvailability}
  WHERE ${eventParkingAvailability.eventId} = ${events.id}
    AND ${eventParkingAvailability.isAvailable}
)`;

const declaredSpotsSql = sql<number>`(
  SELECT coalesce(sum(coalesce(${eventParkingAvailability.spots}, 0)), 0)::int
  FROM ${eventParkingAvailability}
  WHERE ${eventParkingAvailability.eventId} = ${events.id}
    AND ${eventParkingAvailability.isAvailable}
)`;

const bookingCountSql = sql<number>`(
  SELECT count(*)::int FROM ${bookings}
  WHERE ${bookings.eventId} = ${events.id}
    AND ${bookings.status} IN ('CONFIRMED', 'USED')
)`;

export async function listEvents(input: unknown): Promise<Page<AdminEventRow>> {
  const { upcoming, limit, cursor: rawCursor } = eventListSchema.parse(input);
  const cursor = decodeCursor(rawCursor);

  const rows = await db
    .select({
      id: events.id,
      createdAt: events.createdAt,
      title: events.title,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      category: events.category,
      expectedAttendance: events.expectedAttendance,
      searchRadiusMeters: events.searchRadiusMeters,
      venueId: venues.id,
      venueName: venues.name,
      declaredParkings: declaredParkingsSql,
      declaredSpots: declaredSpotsSql,
      bookingCount: bookingCountSql,
    })
    .from(events)
    .innerJoin(venues, eq(venues.id, events.venueId))
    .where(
      and(
        upcoming ? gte(events.endsAt, new Date()) : undefined,
        cursor
          ? sql`(${events.createdAt}, ${events.id}) < (${tstz(cursor.createdAt)}, ${cursor.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(desc(events.createdAt), desc(events.id))
    .limit(limit + 1);

  return toPage(rows, limit);
}

/** Chronological, for the admin list where "what is coming" is the question. */
export async function listUpcomingEvents(limit = 20): Promise<AdminEventRow[]> {
  return db
    .select({
      id: events.id,
      createdAt: events.createdAt,
      title: events.title,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      category: events.category,
      expectedAttendance: events.expectedAttendance,
      searchRadiusMeters: events.searchRadiusMeters,
      venueId: venues.id,
      venueName: venues.name,
      declaredParkings: declaredParkingsSql,
      declaredSpots: declaredSpotsSql,
      bookingCount: bookingCountSql,
    })
    .from(events)
    .innerJoin(venues, eq(venues.id, events.venueId))
    .where(gte(events.endsAt, new Date()))
    .orderBy(asc(events.startsAt))
    .limit(limit);
}

export async function createEvent(input: unknown): Promise<{ eventId: string }> {
  const data = createEventSchema.parse(input);

  const [venue] = await db
    .select({ id: venues.id })
    .from(venues)
    .where(eq(venues.id, data.venueId))
    .limit(1);
  if (!venue) throw notFound("Obiekt");

  const [row] = await db
    .insert(events)
    .values({
      venueId: data.venueId,
      title: data.title,
      description: data.description ?? null,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      category: data.category,
      expectedAttendance: data.expectedAttendance ?? null,
      searchRadiusMeters: data.searchRadiusMeters,
    })
    .returning({ id: events.id });

  if (!row) throw new AdminError("INVALID_STATE", 500, "Nie udało się zapisać wydarzenia.");
  return { eventId: row.id };
}

export async function updateEvent(input: unknown): Promise<{ eventId: string }> {
  const { eventId, ...patch } = updateEventSchema.parse(input);

  const [current] = await db
    .select({ id: events.id, startsAt: events.startsAt, endsAt: events.endsAt })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!current) throw notFound("Wydarzenie");

  const startsAt = patch.startsAt ?? current.startsAt;
  const endsAt = patch.endsAt ?? current.endsAt;
  if (endsAt <= startsAt) {
    throw new AdminError(
      "INVALID_STATE",
      422,
      "Koniec wydarzenia musi wypadać po jego początku. Nic nie zostało zmienione.",
    );
  }

  await db
    .update(events)
    .set({
      ...(patch.venueId !== undefined ? { venueId: patch.venueId } : {}),
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.startsAt !== undefined ? { startsAt } : {}),
      ...(patch.endsAt !== undefined ? { endsAt } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.expectedAttendance !== undefined
        ? { expectedAttendance: patch.expectedAttendance }
        : {}),
      ...(patch.searchRadiusMeters !== undefined
        ? { searchRadiusMeters: patch.searchRadiusMeters }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(events.id, eventId));

  return { eventId };
}

export async function deleteEvent(eventId: string): Promise<{ eventId: string }> {
  const [row] = await db
    .select({
      id: events.id,
      bookingCount: sql<number>`(
        SELECT count(*)::int FROM ${bookings} WHERE ${bookings.eventId} = ${events.id}
      )`,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!row) throw notFound("Wydarzenie");

  // bookings.event_id is ON DELETE SET NULL — deleting an event with bookings
  // would quietly detach paid reservations from what they were bought for.
  if (row.bookingCount > 0) {
    throw new AdminError(
      "IN_USE",
      409,
      `Na to wydarzenie sprzedano ${row.bookingCount} rezerwacji. Usunięcie oderwałoby je od wydarzenia — nic nie zostało zmienione.`,
    );
  }

  await db.delete(events).where(eq(events.id, eventId));
  return { eventId };
}
