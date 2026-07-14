import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { db } from "@/db";
import { bookings, events, parkings } from "@/db/schema";
import { APP_TIME_ZONE } from "@/lib/format";

/**
 * TEMPORARY HOME. This is bookings-domain data (GET /api/host/bookings in
 * API_SPEC §8) and belongs in src/modules/bookings once that module lands; the
 * scanner needs it now to answer "who is coming to my gate tonight" and to give
 * the host a reason to open the app before the network dies. Integration phase:
 * move, do not duplicate.
 */
export type HostBookingRow = {
  id: string;
  startsAt: string;
  endsAt: string;
  spots: number;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "EXPIRED" | "USED" | "NO_SHOW";
  vehiclePlate: string | null;
  parkingTitle: string;
  eventTitle: string | null;
};

export type HostBookingScope = "today" | "upcoming";

export async function listHostBookings(
  hostId: string,
  scope: HostBookingScope,
  now: Date = new Date(),
): Promise<HostBookingRow[]> {
  const owned = await db
    .select({ id: parkings.id, title: parkings.title, address: parkings.address })
    .from(parkings)
    .where(eq(parkings.ownerId, hostId));

  if (owned.length === 0) return [];

  const titles = new Map(
    owned.map((parking) => [parking.id, parking.title ?? parking.address ?? "Parking bez nazwy"]),
  );

  const day = formatInTimeZone(now, APP_TIME_ZONE, "yyyy-MM-dd");
  const dayStart = fromZonedTime(`${day}T00:00:00`, APP_TIME_ZONE);
  const dayEnd = fromZonedTime(`${day}T23:59:59.999`, APP_TIME_ZONE);

  const window =
    scope === "today"
      ? and(lte(bookings.startsAt, dayEnd), gte(bookings.endsAt, dayStart))
      : gte(bookings.startsAt, now);

  const rows = await db
    .select({
      id: bookings.id,
      parkingId: bookings.parkingId,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      spots: bookings.spots,
      status: bookings.status,
      vehiclePlate: bookings.vehiclePlate,
      eventTitle: events.title,
    })
    .from(bookings)
    .leftJoin(events, eq(events.id, bookings.eventId))
    .where(
      and(
        inArray(
          bookings.parkingId,
          owned.map((parking) => parking.id),
        ),
        inArray(bookings.status, ["CONFIRMED", "USED"]),
        window,
      ),
    )
    .orderBy(asc(bookings.startsAt))
    .limit(200);

  return rows.map((row) => ({
    id: row.id,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    spots: row.spots,
    status: row.status,
    vehiclePlate: row.vehiclePlate,
    parkingTitle: titles.get(row.parkingId) ?? "Parking bez nazwy",
    eventTitle: row.eventTitle,
  }));
}
