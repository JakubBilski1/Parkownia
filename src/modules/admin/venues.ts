import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import type { Point } from "@/db/geo";
import { events, venues } from "@/db/schema";
import { AdminError, notFound } from "./errors";
import { createVenueSchema, updateVenueSchema } from "./schemas";

export type VenueRow = {
  id: string;
  name: string;
  address: string | null;
  location: Point;
  capacity: number | null;
  eventCount: number;
};

export async function listVenues(): Promise<VenueRow[]> {
  return db
    .select({
      id: venues.id,
      name: venues.name,
      address: venues.address,
      location: venues.location,
      capacity: venues.capacity,
      eventCount: sql<number>`(
        SELECT count(*)::int FROM ${events} WHERE ${events.venueId} = ${venues.id}
      )`,
    })
    .from(venues)
    .orderBy(asc(venues.name));
}

export async function createVenue(input: unknown): Promise<{ venueId: string }> {
  const data = createVenueSchema.parse(input);

  const [row] = await db
    .insert(venues)
    .values({
      name: data.name,
      address: data.address ?? null,
      location: { lat: data.lat, lng: data.lng },
      capacity: data.capacity ?? null,
    })
    .returning({ id: venues.id });

  if (!row) throw new AdminError("INVALID_STATE", 500, "Nie udało się zapisać obiektu.");
  return { venueId: row.id };
}

export async function updateVenue(input: unknown): Promise<{ venueId: string }> {
  const { venueId, name, address, lat, lng, capacity } = updateVenueSchema.parse(input);

  const [current] = await db
    .select({ id: venues.id, location: venues.location })
    .from(venues)
    .where(eq(venues.id, venueId))
    .limit(1);
  if (!current) throw notFound("Obiekt");

  const location =
    lat !== undefined || lng !== undefined
      ? { lat: lat ?? current.location.lat, lng: lng ?? current.location.lng }
      : undefined;

  await db
    .update(venues)
    .set({
      ...(name !== undefined ? { name } : {}),
      ...(address !== undefined ? { address } : {}),
      ...(capacity !== undefined ? { capacity } : {}),
      ...(location ? { location } : {}),
      updatedAt: new Date(),
    })
    .where(eq(venues.id, venueId));

  return { venueId };
}

export async function deleteVenue(venueId: string): Promise<{ venueId: string }> {
  const [row] = await db
    .select({
      id: venues.id,
      eventCount: sql<number>`(
        SELECT count(*)::int FROM ${events} WHERE ${events.venueId} = ${venues.id}
      )`,
    })
    .from(venues)
    .where(eq(venues.id, venueId))
    .limit(1);

  if (!row) throw notFound("Obiekt");

  if (row.eventCount > 0) {
    throw new AdminError(
      "IN_USE",
      409,
      `Ten obiekt ma ${row.eventCount} przypisanych wydarzeń. Usuń najpierw wydarzenia albo zostaw obiekt — nic nie zostało zmienione.`,
    );
  }

  await db.delete(venues).where(eq(venues.id, venueId));
  return { venueId };
}
