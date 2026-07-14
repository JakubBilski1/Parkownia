import { desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, consents, events, parkings, userRoles, users, venues } from "@/db/schema";
import type { BookingStatus, Point } from "@/db/types";
import { createBooking, type CreatedBooking } from "./availability";
import { DomainError } from "./errors";
import { renderBookingQrDataUrl } from "./qr";
import type { CreateBookingRequest } from "./schemas";
import { canViewBooking, type Viewer } from "./session";

/**
 * INTEGRATION GAP: consent document versions belong to the auth module's
 * registry. Pinned locally so the checkout can record consent today; swap for
 * the shared constant when auth lands.
 */
const CONSENT_DOCUMENT_VERSION = "2026-07-01";

const CODE_COLLISION_RETRIES = 3;

/**
 * The account is created along the way, not before (DESIGN_PRINCIPLES §7,
 * path 1). Forcing a registration screen in front of a driver with eight
 * minutes to kick-off is how the sale is lost. No password is set here — the
 * activation e-mail goes out after the money is in.
 */
async function upsertContactUser(contact: {
  email: string;
  phone: string;
  consents: CreateBookingRequest["consents"];
}): Promise<{ userId: string; created: boolean }> {
  const inserted = await db
    .insert(users)
    .values({ email: contact.email, phone: contact.phone })
    .onConflictDoUpdate({
      target: users.email,
      // Never overwrite a phone number the user already gave us.
      set: { phone: sql`COALESCE(${users.phone}, EXCLUDED.phone)`, updatedAt: sql`now()` },
    })
    .returning({ userId: users.id, createdAt: users.createdAt, updatedAt: users.updatedAt });

  const row = inserted[0];
  if (!row) throw new Error("User upsert returned no row");

  const created = row.createdAt.getTime() === row.updatedAt.getTime();

  await db
    .insert(userRoles)
    .values({ userId: row.userId, role: "DRIVER" })
    .onConflictDoNothing();

  const granted: { kind: "TERMS" | "PRIVACY" | "MARKETING_EMAIL" }[] = [
    { kind: "TERMS" },
    { kind: "PRIVACY" },
  ];
  if (contact.consents.marketingEmail) granted.push({ kind: "MARKETING_EMAIL" });

  await db.insert(consents).values(
    granted.map((entry) => ({
      userId: row.userId,
      kind: entry.kind,
      documentVersion: CONSENT_DOCUMENT_VERSION,
    })),
  );

  return { userId: row.userId, created };
}

export type PlacedBooking = {
  bookingId: string;
  userId: string;
  priceGr: number;
  spots: number;
  startsAt: Date;
  endsAt: Date;
  /** The hold dies here. The checkout screen counts down to it. */
  pendingExpiresAt: Date | null;
};

function isCodeCollision(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505" &&
    String((error as { constraint_name?: unknown }).constraint_name ?? "").includes("code")
  );
}

/**
 * The only entry point of the purchase flow. It resolves the buyer, then hands
 * over to createBooking(), which is the only thing in this codebase allowed to
 * put a row in `bookings`.
 */
export async function placeBooking(request: CreateBookingRequest): Promise<PlacedBooking> {
  const { userId } = await upsertContactUser({
    email: request.contact.email,
    phone: request.contact.phone,
    consents: request.consents,
  });

  let created: CreatedBooking | null = null;

  for (let attempt = 0; attempt < CODE_COLLISION_RETRIES; attempt += 1) {
    try {
      created = await createBooking({
        parkingId: request.parkingId,
        userId,
        eventId: request.eventId ?? null,
        startsAt: request.startsAt ? new Date(request.startsAt) : undefined,
        endsAt: request.endsAt ? new Date(request.endsAt) : undefined,
        spots: request.spots,
        vehiclePlate: request.vehiclePlate ?? null,
      });
      break;
    } catch (error) {
      // 2^40 codes make this astronomically rare, but a collision aborts the
      // transaction, and an aborted purchase is not something to leave to luck.
      if (isCodeCollision(error) && attempt < CODE_COLLISION_RETRIES - 1) continue;
      throw error;
    }
  }

  if (!created) throw new Error("Booking creation exhausted its retries");

  return {
    bookingId: created.booking.id,
    userId,
    priceGr: created.booking.priceGr,
    spots: created.booking.spots,
    startsAt: created.booking.startsAt,
    endsAt: created.booking.endsAt,
    pendingExpiresAt: created.booking.pendingExpiresAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

export type BookingDetail = {
  id: string;
  status: BookingStatus;
  startsAt: Date;
  endsAt: Date;
  spots: number;
  priceGr: number;
  pendingExpiresAt: Date | null;
  refundGr: number | null;
  vehiclePlate: string | null;
  parking: {
    id: string;
    title: string | null;
    address: string | null;
    accessType: string | null;
  };
  event: { id: string; title: string; startsAt: Date; venueName: string | null } | null;
  /**
   * Everything below is revealed only once the money is in (CONFIRMED/USED).
   * A PENDING booking that leaked `accessInstructions` would be a free parking
   * spot for anyone who can open a checkout screen.
   */
  code: string | null;
  qrDataUrl: string | null;
  accessInstructions: string | null;
  entranceLocation: Point | null;
  entranceNotes: string | null;
};

function isReleased(status: BookingStatus): boolean {
  return status === "CONFIRMED" || status === "USED";
}

async function loadBookingRow(bookingId: string) {
  const rows = await db
    .select({
      booking: bookings,
      parkingTitle: parkings.title,
      parkingAddress: parkings.address,
      accessType: parkings.accessType,
      accessInstructions: parkings.accessInstructions,
      entranceLocation: parkings.entranceLocation,
      entranceNotes: parkings.entranceNotes,
      eventId: events.id,
      eventTitle: events.title,
      eventStartsAt: events.startsAt,
      venueName: venues.name,
    })
    .from(bookings)
    .innerJoin(parkings, eq(parkings.id, bookings.parkingId))
    .leftJoin(events, eq(events.id, bookings.eventId))
    .leftJoin(venues, eq(venues.id, events.venueId))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  const row = rows[0];
  if (!row) throw new DomainError("BOOKING_NOT_FOUND");
  return row;
}

export async function getBookingDetail(bookingId: string, viewer: Viewer): Promise<BookingDetail> {
  const row = await loadBookingRow(bookingId);
  const booking = row.booking;

  if (!canViewBooking(viewer, booking)) {
    // 403, not 404: the id came from somewhere, and pretending it does not exist
    // would send a paying driver hunting for a lost booking.
    throw new DomainError("FORBIDDEN");
  }

  const released = isReleased(booking.status);

  return {
    id: booking.id,
    status: booking.status,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    spots: booking.spots,
    priceGr: booking.priceGr,
    pendingExpiresAt: booking.pendingExpiresAt,
    refundGr: booking.refundGr,
    vehiclePlate: booking.vehiclePlate,
    parking: {
      id: booking.parkingId,
      title: row.parkingTitle,
      address: row.parkingAddress,
      accessType: row.accessType,
    },
    event: row.eventId
      ? {
          id: row.eventId,
          title: row.eventTitle ?? "",
          startsAt: row.eventStartsAt ?? booking.startsAt,
          venueName: row.venueName,
        }
      : null,
    code: released ? booking.code : null,
    qrDataUrl: released ? await renderBookingQrDataUrl(booking.code) : null,
    accessInstructions: released ? row.accessInstructions : null,
    entranceLocation: released ? row.entranceLocation : null,
    entranceNotes: released ? row.entranceNotes : null,
  };
}

export type BookingListItem = {
  id: string;
  status: BookingStatus;
  startsAt: Date;
  endsAt: Date;
  spots: number;
  priceGr: number;
  pendingExpiresAt: Date | null;
  parkingTitle: string | null;
  parkingAddress: string | null;
  eventTitle: string | null;
  /** Set only for CONFIRMED/USED — the list shows the code, not just a link to it. */
  code: string | null;
};

/**
 * "Aktywna rezerwacja jest pierwszą rzeczą, jaką widzi" (DESIGN_PRINCIPLES §6.5).
 * The ordering is not chronological: what is live right now comes first, then
 * what is coming, then history. A driver at a barrier scrolls for nothing.
 */
export async function listBookings(viewer: Viewer): Promise<BookingListItem[]> {
  const conditions = [];
  if (viewer.userId) conditions.push(eq(bookings.userId, viewer.userId));
  if (viewer.grantedBookingIds.length > 0) {
    conditions.push(inArray(bookings.id, viewer.grantedBookingIds));
  }
  if (conditions.length === 0) return [];

  const rows = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      spots: bookings.spots,
      priceGr: bookings.priceGr,
      pendingExpiresAt: bookings.pendingExpiresAt,
      code: bookings.code,
      parkingTitle: parkings.title,
      parkingAddress: parkings.address,
      eventTitle: events.title,
    })
    .from(bookings)
    .innerJoin(parkings, eq(parkings.id, bookings.parkingId))
    .leftJoin(events, eq(events.id, bookings.eventId))
    .where(conditions.length === 1 ? conditions[0] : or(...conditions))
    .orderBy(
      sql`CASE
            WHEN ${bookings.status} = 'CONFIRMED' AND ${bookings.endsAt} > now() THEN 0
            WHEN ${bookings.status} = 'PENDING' AND ${bookings.pendingExpiresAt} > now() THEN 1
            ELSE 2
          END`,
      sql`CASE
            WHEN ${bookings.status} IN ('CONFIRMED', 'PENDING') AND ${bookings.endsAt} > now()
            THEN ${bookings.startsAt}
          END ASC NULLS LAST`,
      desc(bookings.startsAt),
    )
    .limit(50);

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    spots: row.spots,
    priceGr: row.priceGr,
    pendingExpiresAt: row.pendingExpiresAt,
    parkingTitle: row.parkingTitle,
    parkingAddress: row.parkingAddress,
    eventTitle: row.eventTitle,
    code: isReleased(row.status) ? row.code : null,
  }));
}

/** Checkout needs to know what it is selling before it sells it. */
export async function getCheckoutContext(input: { parkingId: string; eventId?: string | null }) {
  const rows = await db
    .select({
      id: parkings.id,
      title: parkings.title,
      address: parkings.address,
      status: parkings.status,
      capacity: parkings.capacity,
      parkingType: parkings.parkingType,
      isCovered: parkings.isCovered,
      isGuarded: parkings.isGuarded,
      maxVehicleHeightCm: parkings.maxVehicleHeightCm,
      pricePerHourGr: parkings.pricePerHourGr,
      pricePerDayGr: parkings.pricePerDayGr,
      pricePerEventGr: parkings.pricePerEventGr,
      minBookingMinutes: parkings.minBookingMinutes,
      freeMinutes: parkings.freeMinutes,
      availabilityMode: parkings.availabilityMode,
      entranceNotes: parkings.entranceNotes,
    })
    .from(parkings)
    .where(eq(parkings.id, input.parkingId))
    .limit(1);

  const parking = rows[0];
  if (!parking || parking.status !== "ACTIVE") throw new DomainError("PARKING_NOT_FOUND");

  if (!input.eventId) return { parking, event: null as null | { id: string; title: string; startsAt: Date; endsAt: Date; venueName: string | null } };

  const eventRows = await db
    .select({
      id: events.id,
      title: events.title,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      venueName: venues.name,
    })
    .from(events)
    .innerJoin(venues, eq(venues.id, events.venueId))
    .where(eq(events.id, input.eventId))
    .limit(1);

  const event = eventRows[0];
  if (!event) throw new DomainError("EVENT_NOT_FOUND");
  return { parking, event };
}
