import { createHash, createHmac, randomBytes } from "node:crypto";
import postgres from "postgres";

/**
 * The fixtures speak to the same Postgres the dev server does. Two rules govern
 * everything in this file:
 *
 *  - SET UP through the product's own contracts wherever one exists. The purchase
 *    spec buys through POST /api/bookings, not an INSERT, because a fixture that
 *    fabricates a booking row ends up testing the fixture.
 *  - VERIFY in the database. "The screen said Udostępnione" is not evidence that
 *    a declaration was persisted; a row in event_parking_availability is.
 *
 * What is fabricated here is only the world the product is dropped into: an event
 * that starts in an hour, a token an e-mail would have carried. Those have no
 * user-facing way to exist (the seed ships no bookings and no declarations).
 */

// idle_timeout lets the pool close itself, so the worker process can exit when
// the run is over instead of hanging on an open socket.
export const sql = postgres(process.env.DATABASE_URL as string, {
  max: 4,
  idle_timeout: 2,
  onnotice: () => {},
});

/** Everything this suite creates is named so, and only so, that cleanup can find it. */
export const E2E_TAG = "E2E";
export const E2E_EMAIL_DOMAIN = "parkspot.test";

export const SEED_PASSWORD = "parkspot123";
export const ACCOUNTS = {
  admin: "admin@parkspot.pl",
  host: "host@parkspot.pl",
  business: "firma@parkspot.pl",
  driver: "kierowca@parkspot.pl",
} as const;

/* -------------------------------------------------------------------------- */
/* Hashing — must agree with the app, byte for byte                           */
/* -------------------------------------------------------------------------- */

/** Mirrors src/modules/bookings/code.ts. A mismatch here would silently fail every scan. */
export function hashBookingCode(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase(), "utf8").digest("hex");
}

/** Mirrors src/modules/auth/action-tokens.ts: random secret out, HMAC in the table. */
export function hashActionToken(token: string): string {
  const secret = process.env.ACTION_TOKEN_SECRET;
  if (!secret) throw new Error("ACTION_TOKEN_SECRET is not set — check .env.local");
  return createHmac("sha256", secret).update(token).digest("hex");
}

/* -------------------------------------------------------------------------- */
/* Lookups                                                                    */
/* -------------------------------------------------------------------------- */

export async function userIdByEmail(email: string): Promise<string> {
  const [row] = await sql<{ id: string }[]>`select id from users where email = ${email}`;
  if (!row) throw new Error(`No user ${email}. Run npm run db:seed.`);
  return row.id;
}

export type ParkingRow = {
  id: string;
  title: string | null;
  capacity: number | null;
  price_per_event_gr: number | null;
  price_per_hour_gr: number | null;
  status: string;
  owner_id: string;
  access_instructions: string | null;
};

/** An ACTIVE parking owned by `email`, with a per-event price — i.e. one an event booking can use. */
export async function eventPricedParkingOf(email: string): Promise<ParkingRow> {
  const [row] = await sql<ParkingRow[]>`
    select p.id, p.title, p.capacity, p.price_per_event_gr, p.price_per_hour_gr,
           p.status, p.owner_id, p.access_instructions
    from parkings p
    join users u on u.id = p.owner_id
    where u.email = ${email}
      and p.status = 'ACTIVE'
      and p.price_per_event_gr is not null
      and p.capacity > 0
    order by p.capacity desc
    limit 1`;
  if (!row) throw new Error(`No ACTIVE, event-priced parking owned by ${email}.`);
  return row;
}

/** The map's opening camera — Enea Stadion (src/components/map/map-view.tsx, DEFAULT_CENTER). */
export const MAP_DEFAULT_CENTER = { lng: 16.874, lat: 52.393 } as const;

/**
 * A parking a driver can buy by the hour straight off the map, with an entry
 * secret worth hiding.
 *
 * Two constraints, both load-bearing:
 *
 *  - `availability_mode = ALWAYS`. assertDeclaredAvailable() rejects a plain
 *    from–to booking on an EVENT_ONLY parking and wants a declared window for a
 *    MANUAL one. Picking a pin by eye eventually picks one of those, and the
 *    failure then reads like a checkout bug.
 *  - NEAREST THE MAP'S DEFAULT CENTRE. The pin has to be inside the opening
 *    viewport, or there is nothing on screen to tap. Sorting by distance, rather
 *    than hardcoding a bbox, keeps this true if the camera or the seed moves.
 */
export async function alwaysBookableParking(): Promise<ParkingRow> {
  const [row] = await sql<ParkingRow[]>`
    select id, title, capacity, price_per_event_gr, price_per_hour_gr, status, owner_id,
           access_instructions
    from parkings
    where status = 'ACTIVE'
      and availability_mode = 'ALWAYS'
      and price_per_hour_gr is not null
      and access_instructions is not null
      and capacity > 1
    order by location <-> ST_SetSRID(
      ST_MakePoint(${MAP_DEFAULT_CENTER.lng}, ${MAP_DEFAULT_CENTER.lat}), 4326
    )::geography
    limit 1`;
  if (!row) throw new Error("No ALWAYS + hourly + access_instructions parking. Run npm run db:seed.");
  return row;
}

export async function parkingById(id: string): Promise<ParkingRow | undefined> {
  const [row] = await sql<ParkingRow[]>`
    select id, title, capacity, price_per_event_gr, price_per_hour_gr, status, owner_id,
           access_instructions
    from parkings where id = ${id}`;
  return row;
}

/* -------------------------------------------------------------------------- */
/* An event that is happening now                                             */
/* -------------------------------------------------------------------------- */

export type EventRow = {
  id: string;
  title: string;
  starts_at: Date;
  ends_at: Date;
};

/**
 * The seed's earliest match is eleven days out, and the gate admits a code only
 * within an hour of its booking window (SCAN_WINDOW_BUFFER_MS). Scanning a seed
 * booking today would therefore be a correct REJECTED_TIME, which proves nothing
 * about the happy path. So the scan specs bring their own event, in progress now.
 *
 * starts +1 h / ends +3 h ⇒ booking window (±2 h buffers) = [now−1 h, now+5 h],
 * which contains "now" with room to spare on both sides.
 */
export async function createLiveEvent(title = `${E2E_TAG} Mecz testowy`): Promise<EventRow> {
  const [venue] = await sql<{ id: string }[]>`
    select id from venues where name = 'Enea Stadion' limit 1`;
  if (!venue) throw new Error("Venue 'Enea Stadion' missing. Run npm run db:seed.");

  const startsAt = new Date(Date.now() + 60 * 60_000);
  const endsAt = new Date(Date.now() + 3 * 60 * 60_000);

  const [row] = await sql<EventRow[]>`
    insert into events (venue_id, title, starts_at, ends_at, category, search_radius_meters)
    values (${venue.id}, ${title}, ${startsAt}, ${endsAt}, 'FOOTBALL', 2000)
    on conflict (venue_id, title, starts_at) do update set ends_at = excluded.ends_at
    returning id, title, starts_at, ends_at`;
  if (!row) throw new Error("Event insert returned no row");
  return row;
}

/** The host's declaration: without an is_available row, resolveLimit() returns 0 and nothing sells. */
export async function declareAvailability(input: {
  eventId: string;
  parkingId: string;
  spots: number;
  priceGr: number;
}): Promise<void> {
  await sql`
    insert into event_parking_availability (event_id, parking_id, is_available, spots, price_gr)
    values (${input.eventId}, ${input.parkingId}, true, ${input.spots}, ${input.priceGr})
    on conflict (event_id, parking_id) do update
      set is_available = true, spots = excluded.spots, price_gr = excluded.price_gr`;
}

export type AvailabilityRow = {
  is_available: boolean;
  spots: number | null;
  price_gr: number | null;
};

export async function availabilityRow(
  eventId: string,
  parkingId: string,
): Promise<AvailabilityRow | undefined> {
  const [row] = await sql<AvailabilityRow[]>`
    select is_available, spots, price_gr
    from event_parking_availability
    where event_id = ${eventId} and parking_id = ${parkingId}`;
  return row;
}

/* -------------------------------------------------------------------------- */
/* The link out of the e-mail                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Issues an EVENT_AVAILABILITY action token exactly as the reminder mail does
 * (src/modules/auth/action-tokens.ts): 32 random bytes to the host, the HMAC of
 * them to the table. The raw token is returned because that is what the URL in
 * the e-mail carries — and what the host clicks without logging in.
 */
export async function issueQuickDeclareToken(input: {
  userId: string;
  eventId: string;
  parkingId: string;
  spots: number;
  priceGr: number;
  expiresAt?: Date;
}): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = input.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60_000);

  await sql`
    insert into action_tokens (user_id, purpose, token_hash, payload, expires_at)
    values (
      ${input.userId},
      'EVENT_AVAILABILITY',
      ${hashActionToken(token)},
      ${sql.json({
        eventId: input.eventId,
        parkingId: input.parkingId,
        spots: input.spots,
        priceGr: input.priceGr,
      })},
      ${expiresAt}
    )`;

  return token;
}

/* -------------------------------------------------------------------------- */
/* Bookings                                                                   */
/* -------------------------------------------------------------------------- */

export type BookingRow = {
  id: string;
  code: string;
  code_hash: string;
  status: string;
  price_gr: number;
  spots: number;
  parking_id: string;
  event_id: string | null;
  starts_at: Date;
  ends_at: Date;
};

const BOOKING_COLUMNS = sql`
  id, code, code_hash, status, price_gr, spots, parking_id, event_id, starts_at, ends_at`;

export async function bookingById(id: string): Promise<BookingRow | undefined> {
  const [row] = await sql<BookingRow[]>`
    select ${BOOKING_COLUMNS} from bookings where id = ${id}`;
  return row;
}

export async function bookingByCode(code: string): Promise<BookingRow | undefined> {
  const [row] = await sql<BookingRow[]>`
    select ${BOOKING_COLUMNS} from bookings where code = ${code}`;
  return row;
}

export async function scansOf(bookingId: string): Promise<
  Array<{ result: string; offline: boolean; conflict: boolean; device_id: string | null }>
> {
  return sql<Array<{ result: string; offline: boolean; conflict: boolean; device_id: string | null }>>`
    select result, offline, conflict, device_id
    from booking_scans where booking_id = ${bookingId}
    order by scanned_at`;
}

/* -------------------------------------------------------------------------- */
/* Housekeeping                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The suite logs in repeatedly and pans the map; POST /api/auth/* is capped at
 * 5/min per IP and would start answering 429 halfway through the run. Clearing
 * the fixed-window table is the test-environment equivalent of waiting a minute.
 */
export async function resetRateLimits(): Promise<void> {
  await sql`delete from rate_limits`;
}

/**
 * Removes only what this suite made — matched by the tag, never by "delete from
 * bookings". The seed's 20 parkings and 17 events survive a run untouched.
 *
 * Order follows the foreign keys: payments and payout_items RESTRICT deletion of
 * a booking, and bookings RESTRICT deletion of a parking and of a user.
 */
export async function cleanupE2eArtifacts(): Promise<void> {
  const doomed = sql`
    select b.id from bookings b
    left join events e on e.id = b.event_id
    left join users u on u.id = b.user_id
    left join parkings p on p.id = b.parking_id
    where e.title like ${`${E2E_TAG}%`}
       or u.email like ${`%@${E2E_EMAIL_DOMAIN}`}
       or p.title like ${`${E2E_TAG}%`}`;

  await sql`delete from payout_items where booking_id in (${doomed})`;
  await sql`delete from payments where booking_id in (${doomed})`;
  await sql`delete from bookings where id in (${doomed})`;

  await sql`delete from events where title like ${`${E2E_TAG}%`}`;
  await sql`delete from parkings where title like ${`${E2E_TAG}%`}`;
  await sql`delete from users where email like ${`%@${E2E_EMAIL_DOMAIN}`}`;

  // Declarations the specs made on SEED parkings for SEED events: the event tag
  // cannot find these, because neither side of the row is ours.
  await sql`
    delete from event_parking_availability a
    using events e
    where e.id = a.event_id and e.title like ${`${E2E_TAG}%`}`;
}
