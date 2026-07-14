import { eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { parkings } from "@/db/schema";
import { tstz } from "@/db/time";
import { ApiError } from "./errors";
import { EVENT_BUFFER_MINUTES } from "./pricing";

/**
 * Availability is decided in Postgres, never in JavaScript: the same predicate has
 * to run inside a bounding-box map query over thousands of rows and inside the
 * booking transaction that holds a row lock. Two implementations would drift, and
 * the one that drifts sells the same spot twice.
 *
 * Time model: a recurring schedule is written in local Europe/Warsaw hours because
 * "after work" is a local idea. It is expanded against local dates and converted to
 * UTC by Postgres (AT TIME ZONE), which is also what makes the DST weekends correct.
 */

export type Window = { from: Date; to: Date };

const TZ = "Europe/Warsaw";

// Postgres has no 24:00 clock time, but a host writing "17:00–24:00" means
// midnight. So does a slot whose end is not after its start (22:00–02:00).
const DOW_TO_KEY = sql.raw(`(ARRAY['sun','mon','tue','wed','thu','fri','sat'])`);

function range(window: Window): SQL {
  return sql`tstzrange(${tstz(window.from)}, ${tstz(window.to)}, '[)')`;
}

function scheduleCoversSql(window: Window): SQL<boolean> {
  return sql<boolean>`(
    SELECT COALESCE(range_agg(slot.r), '{}'::tstzmultirange) @> ${range(window)}
    FROM (
      SELECT tstzrange(
        (d::date + (s->>'from')::time) AT TIME ZONE ${sql.raw(`'${TZ}'`)},
        (CASE
          WHEN (s->>'to') = '24:00' THEN (d::date + 1)::timestamp
          WHEN (s->>'to')::time <= (s->>'from')::time THEN (d::date + 1) + (s->>'to')::time
          ELSE d::date + (s->>'to')::time
        END) AT TIME ZONE ${sql.raw(`'${TZ}'`)},
        '[)'
      ) AS r
      FROM generate_series(
        ((${tstz(window.from)} AT TIME ZONE ${sql.raw(`'${TZ}'`)})::date - 1)::timestamp,
        ((${tstz(window.to)} AT TIME ZONE ${sql.raw(`'${TZ}'`)})::date)::timestamp,
        interval '1 day'
      ) AS d
      CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(${parkings.schedule} -> ${DOW_TO_KEY}[EXTRACT(dow FROM d)::int + 1], '[]'::jsonb)
      ) AS s
    ) slot
  )`;
}

function manualWindowsCoverSql(window: Window): SQL<boolean> {
  return sql<boolean>`(
    SELECT COALESCE(range_agg(tstzrange(w.starts_at, w.ends_at, '[)')), '{}'::tstzmultirange)
           @> ${range(window)}
    FROM parking_availability_windows w
    WHERE w.parking_id = ${parkings.id}
  )`;
}

function eventOnlyCoversSql(window: Window): SQL<boolean> {
  return sql<boolean>`EXISTS (
    SELECT 1
    FROM event_parking_availability epa
    JOIN events e ON e.id = epa.event_id
    WHERE epa.parking_id = ${parkings.id}
      AND epa.is_available
      AND tstzrange(
            e.starts_at - ${sql.raw(`interval '${EVENT_BUFFER_MINUTES} minutes'`)},
            e.ends_at   + ${sql.raw(`interval '${EVENT_BUFFER_MINUTES} minutes'`)},
            '[]'
          ) @> ${range(window)}
  )`;
}

/** A blackout kills the whole local day, whatever the schedule says. */
/**
 * Exported because the events module needs the identical rule. Two copies of
 * "which days the host closed the gate" is how a parking gets sold on a day it
 * is shut.
 */
export function notBlackedOutSql(window: Window): SQL<boolean> {
  return sql<boolean>`NOT EXISTS (
    SELECT 1
    FROM parking_blackout_dates b
    WHERE b.parking_id = ${parkings.id}
      AND tstzrange(
            (b.date::timestamp) AT TIME ZONE ${sql.raw(`'${TZ}'`)},
            (b.date::timestamp + interval '1 day') AT TIME ZONE ${sql.raw(`'${TZ}'`)},
            '[)'
          ) && ${range(window)}
  )`;
}

export function modeCoversWindowSql(window: Window): SQL<boolean> {
  return sql<boolean>`(CASE ${parkings.availabilityMode}
    WHEN 'ALWAYS' THEN true
    WHEN 'RECURRING_SCHEDULE' THEN ${scheduleCoversSql(window)}
    WHEN 'MANUAL' THEN ${manualWindowsCoverSql(window)}
    WHEN 'EVENT_ONLY' THEN ${eventOnlyCoversSql(window)}
    ELSE false
  END)`;
}

/**
 * PENDING counts as taken only while its 15-minute TTL is alive — an abandoned
 * checkout must not hold the last spot at kick-off. The status test is parenthesised
 * on purpose: `status = 'CONFIRMED' OR status = 'PENDING' AND …` would bind the AND
 * first and silently count every expired PENDING as occupied.
 */
export function occupiedSpotsSql(window: Window): SQL<number> {
  return sql<number>`COALESCE((
    SELECT SUM(bk.spots)
    FROM bookings bk
    WHERE bk.parking_id = ${parkings.id}
      AND (
        bk.status = 'CONFIRMED'
        OR (bk.status = 'PENDING' AND bk.pending_expires_at > now())
      )
      AND bk.starts_at < ${tstz(window.to)}
      AND bk.ends_at   > ${tstz(window.from)}
  ), 0)::int`;
}

/**
 * The ceiling is the strictest of: physical capacity, the spots the host released
 * for an overlapping MANUAL window, and the spots declared for the event. LEAST
 * skips NULLs, so an undeclared limit means "no extra limit", not "zero".
 */
export function effectiveCapacitySql(window: Window, eventId?: string): SQL<number> {
  const manualLimit = sql`(
    SELECT MIN(w.spots)
    FROM parking_availability_windows w
    WHERE w.parking_id = ${parkings.id}
      AND w.starts_at < ${tstz(window.to)}
      AND w.ends_at   > ${tstz(window.from)}
  )`;

  const eventLimit = eventId
    ? sql`(
        SELECT epa.spots
        FROM event_parking_availability epa
        WHERE epa.parking_id = ${parkings.id}
          AND epa.event_id = ${eventId}::uuid
          AND epa.is_available
      )`
    : sql`NULL::int`;

  return sql<number>`LEAST(
    ${parkings.capacity},
    COALESCE(${manualLimit}, ${parkings.capacity}),
    COALESCE(${eventLimit}, ${parkings.capacity})
  )::int`;
}

export function freeSpotsSql(window: Window, eventId?: string): SQL<number> {
  return sql<number>`GREATEST(
    ${effectiveCapacitySql(window, eventId)} - ${occupiedSpotsSql(window)},
    0
  )::int`;
}

export type AvailabilityQuery = Window & {
  spots?: number;
  eventId?: string;
};

/**
 * The single predicate that decides whether a parking may be sold in a window.
 * Reused by the map query, the parking card and (in integration) the booking
 * transaction — one definition, one behaviour.
 */
export function isAvailableSql(query: AvailabilityQuery): SQL<boolean> {
  const spots = query.spots ?? 1;
  const window: Window = { from: query.from, to: query.to };

  return sql<boolean>`(
    ${parkings.status} = 'ACTIVE'
    AND ${modeCoversWindowSql(window)}
    AND ${notBlackedOutSql(window)}
    AND ${freeSpotsSql(window, query.eventId)} >= ${spots}
  )`;
}

export type UnavailableReason =
  | "NOT_ACTIVE"
  | "OUTSIDE_SCHEDULE"
  | "BLACKOUT"
  | "FULL"
  | "TOO_SMALL_CAPACITY";

export type AvailabilityResult = {
  available: boolean;
  freeSpots: number;
  capacity: number;
  reason: UnavailableReason | null;
};

export async function getAvailability(
  parkingId: string,
  query: AvailabilityQuery,
): Promise<AvailabilityResult> {
  const spots = query.spots ?? 1;
  const window: Window = { from: query.from, to: query.to };

  const [row] = await db
    .select({
      isActive: sql<boolean>`${parkings.status} = 'ACTIVE'`,
      covered: modeCoversWindowSql(window),
      notBlackedOut: notBlackedOutSql(window),
      capacity: effectiveCapacitySql(window, query.eventId),
      freeSpots: freeSpotsSql(window, query.eventId),
    })
    .from(parkings)
    .where(eq(parkings.id, parkingId))
    .limit(1);

  if (!row) {
    throw new ApiError("NOT_FOUND", "Nie znaleźliśmy tego parkingu.");
  }

  const reason: UnavailableReason | null = !row.isActive
    ? "NOT_ACTIVE"
    : !row.notBlackedOut
      ? "BLACKOUT"
      : !row.covered
        ? "OUTSIDE_SCHEDULE"
        : row.capacity < spots
          ? "TOO_SMALL_CAPACITY"
          : row.freeSpots < spots
            ? "FULL"
            : null;

  return {
    available: reason === null,
    freeSpots: row.freeSpots,
    capacity: row.capacity,
    reason,
  };
}

const REASON_COPY: Record<UnavailableReason, string> = {
  NOT_ACTIVE: "Ten parking nie jest teraz w sprzedaży.",
  OUTSIDE_SCHEDULE: "Host nie udostępnia tego parkingu w wybranych godzinach.",
  BLACKOUT: "Host zamknął ten parking w wybranym dniu.",
  FULL: "Wszystkie miejsca na ten termin są już zajęte.",
  TOO_SMALL_CAPACITY: "Ten parking nie ma tylu miejsc.",
};

export function unavailableMessage(reason: UnavailableReason): string {
  return REASON_COPY[reason];
}
