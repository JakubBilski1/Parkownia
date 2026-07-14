import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  eventParkingAvailability,
  events,
  notificationLog,
  parkings,
  payments,
  userRoles,
  users,
  venues,
} from "@/db/schema";
import type { SelectBooking } from "@/db/types";

/**
 * Everything this suite creates is tagged, and cleanup deletes exactly what is
 * tagged. The alternative — TRUNCATE — would work too, right up until someone
 * runs the suite with TEST_DATABASE_URL pointing somewhere it should not, and it
 * would take the seed (and any other database's data) with it.
 *
 * Seed rows use @parkspot.pl addresses and untagged titles, so they are invisible
 * to every statement in cleanupTestData().
 */
export const TEST_EMAIL_DOMAIN = "test.parkspot.local";
export const TEST_TAG = "[itest]";

const isTestUser = sql`${users.email} LIKE ${`%@${TEST_EMAIL_DOMAIN}`}`;
const testUserIds = sql`(SELECT id FROM users WHERE email LIKE ${`%@${TEST_EMAIL_DOMAIN}`})`;
const testParkingIds = sql`(SELECT id FROM parkings WHERE owner_id IN ${testUserIds})`;
const testEventIds = sql`(SELECT id FROM events WHERE title LIKE ${`${TEST_TAG}%`})`;

/* -------------------------------------------------------------------------- */
/* Cleanup                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Delete order is FK order. bookings→parkings and bookings→users are ON DELETE
 * RESTRICT (a settled booking must survive its parking being removed), so the
 * money rows have to go first, in this order, or the delete simply fails.
 */
export async function cleanupTestData(): Promise<void> {
  await db.execute(sql`DELETE FROM booking_scans WHERE booking_id IN (
    SELECT id FROM bookings WHERE user_id IN ${testUserIds} OR parking_id IN ${testParkingIds})`);

  await db.execute(sql`DELETE FROM payout_items WHERE booking_id IN (
    SELECT id FROM bookings WHERE user_id IN ${testUserIds} OR parking_id IN ${testParkingIds})`);

  await db.execute(sql`DELETE FROM payments WHERE booking_id IN (
    SELECT id FROM bookings WHERE user_id IN ${testUserIds} OR parking_id IN ${testParkingIds})`);

  await db.execute(
    sql`DELETE FROM bookings WHERE user_id IN ${testUserIds} OR parking_id IN ${testParkingIds}`,
  );

  await db.execute(sql`DELETE FROM payouts WHERE host_id IN ${testUserIds}`);

  await db.execute(
    sql`DELETE FROM event_parking_availability
         WHERE parking_id IN ${testParkingIds} OR event_id IN ${testEventIds}`,
  );

  await db.execute(sql`DELETE FROM parkings WHERE owner_id IN ${testUserIds}`);
  await db.execute(sql`DELETE FROM events WHERE title LIKE ${`${TEST_TAG}%`}`);

  // user_roles, consents, notification_log, refresh_tokens and action_tokens are
  // ON DELETE CASCADE — they go with the user.
  await db.delete(users).where(isTestUser);

  await db.execute(sql`DELETE FROM webhook_events WHERE event_id LIKE 'itest_%'`);
  await db.execute(sql`DELETE FROM rate_limits WHERE key LIKE '%198.51.100.%'`);
}

/** The application's pool lives on globalThis (HMR survival). Drop it with the file. */
export async function closeDb(): Promise<void> {
  const client = globalThis.__parkspotSql;
  if (!client) return;
  await client.end({ timeout: 5 });
  globalThis.__parkspotSql = undefined;
}

/* -------------------------------------------------------------------------- */
/* Users                                                                      */
/* -------------------------------------------------------------------------- */

export function testEmail(prefix: string): string {
  return `${prefix}-${randomUUID()}@${TEST_EMAIL_DOMAIN}`;
}

export async function createDriver(): Promise<{ id: string; email: string; phone: string }> {
  const email = testEmail("driver");
  const phone = "+48601234567";

  const [user] = await db.insert(users).values({ email, phone }).returning({ id: users.id });
  if (!user) throw new Error("driver insert returned no row");

  await db.insert(userRoles).values({ userId: user.id, role: "DRIVER" }).onConflictDoNothing();
  return { id: user.id, email, phone };
}

export async function createHost(): Promise<{ id: string; email: string }> {
  const email = testEmail("host");

  const [user] = await db.insert(users).values({ email }).returning({ id: users.id });
  if (!user) throw new Error("host insert returned no row");

  await db
    .insert(userRoles)
    .values({ userId: user.id, role: "HOST_INDIVIDUAL" })
    .onConflictDoNothing();

  return { id: user.id, email };
}

/* -------------------------------------------------------------------------- */
/* Parkings                                                                   */
/* -------------------------------------------------------------------------- */

/** Enea Stadion, where the load actually is. */
export const ENEA = { lat: 52.3977, lng: 16.8581 };

export type ParkingOptions = {
  ownerId: string;
  capacity: number;
  pricePerHourGr?: number;
  pricePerEventGr?: number;
  accessInstructions?: string | null;
  payoutBankAccount?: string | null;
  status?: "ACTIVE" | "PAUSED" | "DRAFT";
  location?: { lat: number; lng: number };
};

export async function createParking(options: ParkingOptions): Promise<{ id: string }> {
  const [parking] = await db
    .insert(parkings)
    .values({
      ownerId: options.ownerId,
      ownerType: "INDIVIDUAL",
      status: options.status ?? "ACTIVE",
      title: `${TEST_TAG} Parking ${randomUUID().slice(0, 8)}`,
      location: options.location ?? ENEA,
      entranceLocation: { lat: ENEA.lat + 0.0005, lng: ENEA.lng + 0.0005 },
      entranceNotes: "Wjazd od ul. Bułgarskiej.",
      address: "ul. Bułgarska 17, Poznań",
      capacity: options.capacity,
      parkingType: "OUTDOOR_LOT",
      accessType: "BARRIER_CODE",
      accessInstructions: options.accessInstructions ?? null,
      payoutBankAccount: options.payoutBankAccount ?? null,
      availabilityMode: "ALWAYS",
      pricePerHourGr: options.pricePerHourGr ?? 1000,
      pricePerEventGr: options.pricePerEventGr ?? 3000,
      minBookingMinutes: 30,
    })
    .returning({ id: parkings.id });

  if (!parking) throw new Error("parking insert returned no row");
  return parking;
}

/**
 * Bulk parkings for the planner. A GiST index is only *chosen* when there is
 * enough of a table to make scanning it look expensive, so the query-plan
 * regression test needs a realistic map, not five rows.
 */
export async function createBulkParkings(ownerId: string, count: number): Promise<void> {
  await db.execute(sql`
    INSERT INTO parkings (owner_id, owner_type, status, title, location, capacity,
                          price_per_hour_gr, availability_mode, profile_completeness)
    SELECT ${ownerId}::uuid, 'INDIVIDUAL', 'ACTIVE', ${`${TEST_TAG} geo `} || g,
           ST_SetSRID(ST_MakePoint(16.80 + random() * 0.25, 52.35 + random() * 0.15), 4326)::geography,
           10, 1000, 'ALWAYS', 50
      FROM generate_series(1, ${count}) g
  `);

  // Without fresh statistics the planner is costing a table it thinks is empty.
  await db.execute(sql`ANALYZE parkings`);
}

/* -------------------------------------------------------------------------- */
/* Events                                                                     */
/* -------------------------------------------------------------------------- */

export async function createEvent(input?: {
  startsAt?: Date;
  endsAt?: Date;
}): Promise<{ id: string; startsAt: Date; endsAt: Date }> {
  const [venue] = await db.select({ id: venues.id }).from(venues).limit(1);
  if (!venue) throw new Error("No venue in the database — run the seed.");

  const startsAt = input?.startsAt ?? hoursFromNow(24);
  const endsAt = input?.endsAt ?? hoursFromNow(26);

  const [event] = await db
    .insert(events)
    .values({
      venueId: venue.id,
      title: `${TEST_TAG} Mecz ${randomUUID().slice(0, 8)}`,
      startsAt,
      endsAt,
      category: "FOOTBALL",
    })
    .returning({ id: events.id });

  if (!event) throw new Error("event insert returned no row");
  return { id: event.id, startsAt, endsAt };
}

export async function declareEventAvailability(input: {
  eventId: string;
  parkingId: string;
  spots?: number | null;
  priceGr?: number | null;
}): Promise<void> {
  await db.insert(eventParkingAvailability).values({
    eventId: input.eventId,
    parkingId: input.parkingId,
    isAvailable: true,
    spots: input.spots ?? null,
    priceGr: input.priceGr ?? null,
  });
}

/* -------------------------------------------------------------------------- */
/* Time                                                                       */
/* -------------------------------------------------------------------------- */

export function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 3_600_000);
}

/** A window that is always in the future — createBooking() rejects the past. */
export function futureWindow(offsetHours = 2, durationHours = 3) {
  return {
    startsAt: hoursFromNow(offsetHours),
    endsAt: hoursFromNow(offsetHours + durationHours),
  };
}

/**
 * Fifteen minutes of wall-clock time, without fifteen minutes of wall-clock time.
 * The TTL is enforced in SQL against now(), so moving the deadline into the past
 * is exactly equivalent to waiting — and it is the only honest way to test a
 * timeout in under a second.
 */
export async function expirePendingHold(bookingId: string): Promise<void> {
  await db
    .update(bookings)
    .set({ pendingExpiresAt: sql`now() - interval '1 minute'` })
    .where(eq(bookings.id, bookingId));
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

export async function getBooking(bookingId: string): Promise<SelectBooking> {
  const [row] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!row) throw new Error(`No booking ${bookingId}`);
  return row;
}

export async function findPayment(bookingId: string) {
  const [row] = await db.select().from(payments).where(eq(payments.bookingId, bookingId)).limit(1);
  return row ?? null;
}

export async function countBookingsFor(parkingId: string): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(bookings)
    .where(eq(bookings.parkingId, parkingId));
  return row?.value ?? 0;
}

/** Spots actually held on a parking — the invariant that must never exceed capacity. */
export async function occupiedSpots(parkingId: string): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`COALESCE(SUM(${bookings.spots}), 0)::int` })
    .from(bookings)
    .where(
      sql`${bookings.parkingId} = ${parkingId}
        AND (${bookings.status} IN ('CONFIRMED', 'USED')
             OR (${bookings.status} = 'PENDING' AND ${bookings.pendingExpiresAt} > now()))`,
    );
  return row?.value ?? 0;
}

export async function notificationsFor(userId: string) {
  return db
    .select({
      template: notificationLog.template,
      status: notificationLog.status,
      relatedId: notificationLog.relatedId,
      sentAt: notificationLog.sentAt,
    })
    .from(notificationLog)
    .where(eq(notificationLog.userId, userId));
}

/* -------------------------------------------------------------------------- */
/* Async settling                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Confirmation mail is deliberately not awaited by the webhook (docs/PAYMENTS.md
 * §3.1.4 — answer 200 first, send after), so a test that asserts on it right away
 * is racing the code it is testing. Poll instead of sleeping a magic number.
 */
export async function waitFor(
  predicate: () => Promise<boolean>,
  { timeoutMs = 5_000, intervalMs = 25 } = {},
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    if (await predicate()) return;
    if (Date.now() > deadline) throw new Error("waitFor: condition not met before the deadline");
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/** Give already-scheduled fire-and-forget work a chance to run before asserting it did NOT. */
export async function settle(ms = 300): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
