import { asc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import type { Point } from "@/db/geo";
import { events, venues } from "@/db/schema";
import type { EventCategory } from "@/db/types";
import { eventIdPrefixFromSlug, eventSlug } from "./slug";

export type EventVenue = {
  id: string;
  name: string;
  address: string | null;
  location: Point;
};

export type EventSummary = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  category: EventCategory;
  expectedAttendance: number | null;
  searchRadiusMeters: number;
  venue: EventVenue;
};

const eventColumns = {
  id: events.id,
  title: events.title,
  description: events.description,
  startsAt: events.startsAt,
  endsAt: events.endsAt,
  category: events.category,
  expectedAttendance: events.expectedAttendance,
  searchRadiusMeters: events.searchRadiusMeters,
  venueId: venues.id,
  venueName: venues.name,
  venueAddress: venues.address,
  venueLocation: venues.location,
};

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  category: EventCategory;
  expectedAttendance: number | null;
  searchRadiusMeters: number;
  venueId: string;
  venueName: string;
  venueAddress: string | null;
  venueLocation: Point;
};

function toSummary(row: EventRow): EventSummary {
  return {
    id: row.id,
    slug: eventSlug({ id: row.id, title: row.title, startsAt: row.startsAt }),
    title: row.title,
    description: row.description,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    category: row.category,
    expectedAttendance: row.expectedAttendance,
    searchRadiusMeters: row.searchRadiusMeters,
    venue: {
      id: row.venueId,
      name: row.venueName,
      address: row.venueAddress,
      location: row.venueLocation,
    },
  };
}

/**
 * "Upcoming" means the event has not ended yet, not that it has not started:
 * a fair running today is still worth a parking spot this afternoon.
 */
export async function listUpcomingEvents(limit = 50): Promise<EventSummary[]> {
  const rows = await db
    .select(eventColumns)
    .from(events)
    .innerJoin(venues, eq(venues.id, events.venueId))
    .where(gte(events.endsAt, sql`now()`))
    .orderBy(asc(events.startsAt))
    .limit(limit);

  return rows.map(toSummary);
}

export async function listAllEvents(limit = 50): Promise<EventSummary[]> {
  const rows = await db
    .select(eventColumns)
    .from(events)
    .innerJoin(venues, eq(venues.id, events.venueId))
    .orderBy(asc(events.startsAt))
    .limit(limit);

  return rows.map(toSummary);
}

export async function getEventById(id: string): Promise<EventSummary | null> {
  const [row] = await db
    .select(eventColumns)
    .from(events)
    .innerJoin(venues, eq(venues.id, events.venueId))
    .where(eq(events.id, id))
    .limit(1);

  return row ? toSummary(row) : null;
}

export async function getEventBySlug(slug: string): Promise<EventSummary | null> {
  const idPrefix = eventIdPrefixFromSlug(slug);
  if (!idPrefix) return null;

  const [row] = await db
    .select(eventColumns)
    .from(events)
    .innerJoin(venues, eq(venues.id, events.venueId))
    .where(sql`${events.id}::text LIKE ${`${idPrefix}%`}`)
    .limit(1);

  return row ? toSummary(row) : null;
}
