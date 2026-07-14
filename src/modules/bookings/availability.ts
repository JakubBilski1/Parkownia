import { and, desc, eq, gt, inArray, lt, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  eventParkingAvailability,
  events,
  parkings,
  refundPolicies,
} from "@/db/schema";
import type { SelectBooking } from "@/db/types";
import {
  effectiveCapacitySql,
  modeCoversWindowSql,
  notBlackedOutSql,
  type Window,
} from "@/modules/parkings/availability";
import { resolveCommissionSplit } from "@/modules/payouts/service";
import { generateBookingCode, hashBookingCode } from "./code";
import { DomainError } from "./errors";
import { eventBookingWindow, quotePrice, type PriceQuote } from "./pricing";

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** docs/PAYMENTS.md §2.1 — an unpaid hold on a spot lasts 15 minutes and no longer. */
export const PENDING_TTL_MINUTES = 15;

export type CreateBookingInput = {
  parkingId: string;
  userId: string;
  eventId?: string | null;
  startsAt?: Date;
  endsAt?: Date;
  spots: number;
  vehiclePlate?: string | null;
};

export type CreatedBooking = {
  booking: SelectBooking;
  quote: PriceQuote;
};

/* -------------------------------------------------------------------------- */
/* Occupancy                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Everything that physically holds a spot in [startsAt, endsAt):
 *   CONFIRMED — paid, car is coming
 *   USED      — paid, car is already inside (its spot is the most occupied spot
 *               there is; leaving it out of this sum is how you oversell a lot
 *               mid-event)
 *   PENDING   — someone is in the payment sheet right now, but only until the
 *               15-minute TTL runs out
 *
 * CANCELLED / EXPIRED / NO_SHOW release the spot.
 *
 * Callers MUST hold a FOR UPDATE lock on the parking row before calling this,
 * or the count is a snapshot that another transaction can invalidate a
 * microsecond later.
 */
async function countOccupied(
  tx: Tx,
  input: { parkingId: string; startsAt: Date; endsAt: Date; excludeBookingId?: string },
): Promise<number> {
  const rows = await tx
    .select({ taken: sql<number>`COALESCE(SUM(${bookings.spots}), 0)::int` })
    .from(bookings)
    .where(
      and(
        eq(bookings.parkingId, input.parkingId),
        // Half-open overlap: a booking ending exactly when another starts does
        // not overlap it.
        lt(bookings.startsAt, input.endsAt),
        gt(bookings.endsAt, input.startsAt),
        or(
          inArray(bookings.status, ["CONFIRMED", "USED"]),
          and(eq(bookings.status, "PENDING"), gt(bookings.pendingExpiresAt, sql`now()`)),
        ),
        input.excludeBookingId ? ne(bookings.id, input.excludeBookingId) : undefined,
      ),
    );

  return rows[0]?.taken ?? 0;
}

type LockedParking = {
  id: string;
  ownerId: string;
  ownerType: "INDIVIDUAL" | "BUSINESS";
  status: string;
  capacity: number | null;
  availabilityMode: string;
  schedule: unknown;
  pricePerHourGr: number | null;
  pricePerDayGr: number | null;
  pricePerEventGr: number | null;
  minBookingMinutes: number;
  freeMinutes: number;
};

async function lockParking(tx: Tx, parkingId: string): Promise<LockedParking> {
  const rows = await tx
    .select({
      id: parkings.id,
      ownerId: parkings.ownerId,
      ownerType: parkings.ownerType,
      status: parkings.status,
      capacity: parkings.capacity,
      availabilityMode: parkings.availabilityMode,
      schedule: parkings.schedule,
      pricePerHourGr: parkings.pricePerHourGr,
      pricePerDayGr: parkings.pricePerDayGr,
      pricePerEventGr: parkings.pricePerEventGr,
      minBookingMinutes: parkings.minBookingMinutes,
      freeMinutes: parkings.freeMinutes,
    })
    .from(parkings)
    .where(eq(parkings.id, parkingId))
    // The serialization point of the whole system. Concurrent buyers of THIS
    // parking queue here; buyers of other parkings never wait.
    .for("update")
    .limit(1);

  const parking = rows[0];
  if (!parking) throw new DomainError("PARKING_NOT_FOUND");
  return parking as LockedParking;
}

/**
 * How many spots this parking may sell in this window — 0 when it may not sell
 * at all. This is THE ceiling; `countOccupied` is subtracted from it.
 *
 * It is deliberately the *same* rule the map, the parking card and
 * `listEventParkings` run, evaluated here on the row we already hold FOR UPDATE:
 *
 *   sellable = not blacked out
 *              AND ( host declared this event "tak"
 *                    OR (no declaration at all AND the parking's own availability
 *                        mode covers the whole window) )
 *
 * An explicit "tak" beats the schedule — it is the newer, more specific decision.
 * An explicit "nie tym razem" beats everything. No declaration is NOT a "nie":
 * an always-open garage 400 m from the stadium sells on match day without its
 * operator clicking anything, which is exactly what the listing already promises
 * the driver.
 *
 * `effectiveCapacitySql` cannot be used on its own here: for a *withdrawn*
 * declaration its subquery yields NULL, which COALESCEs to full capacity. The
 * listing excludes withdrawn parkings in its WHERE clause; this function has to
 * do the same, or the one place that takes money would be the most permissive.
 *
 * Returns a number — it never throws for "not offered". The confirmation path
 * calls this after the money has already moved: if a withdrawn declaration threw,
 * the webhook would 500, the PSP would retry for three days, and we would sit on
 * the driver's cash. Zero is an answer; an exception is not.
 */
async function resolveLimit(
  tx: Tx,
  parking: LockedParking,
  eventId: string | null | undefined,
  window: { startsAt: Date; endsAt: Date },
): Promise<number> {
  const capacity = parking.capacity ?? 0;
  if (capacity <= 0) return 0;

  const sqlWindow: Window = { from: window.startsAt, to: window.endsAt };

  const declaredAvailable = eventId
    ? sql<boolean>`EXISTS (
        SELECT 1 FROM event_parking_availability epa
        WHERE epa.parking_id = ${parkings.id}
          AND epa.event_id = ${eventId}::uuid
          AND epa.is_available
      )`
    : sql<boolean>`false`;

  const hasDeclaration = eventId
    ? sql<boolean>`EXISTS (
        SELECT 1 FROM event_parking_availability epa
        WHERE epa.parking_id = ${parkings.id}
          AND epa.event_id = ${eventId}::uuid
      )`
    : sql<boolean>`false`;

  const rows = await tx
    .select({
      notBlackedOut: notBlackedOutSql(sqlWindow),
      modeCovers: modeCoversWindowSql(sqlWindow),
      declaredAvailable,
      hasDeclaration,
      effectiveCapacity: effectiveCapacitySql(sqlWindow, eventId ?? undefined),
    })
    .from(parkings)
    .where(eq(parkings.id, parking.id))
    .limit(1);

  const row = rows[0];
  if (!row) return 0;

  if (!row.notBlackedOut) return 0;

  const offered = row.declaredAvailable || (!row.hasDeclaration && row.modeCovers);
  if (!offered) return 0;

  return Math.max(0, Math.min(capacity, Number(row.effectiveCapacity)));
}

/* -------------------------------------------------------------------------- */
/* The one and only way a booking row comes into existence                    */
/* -------------------------------------------------------------------------- */

/**
 * BEGIN → SELECT parking FOR UPDATE → count occupancy in the window → INSERT
 * PENDING → COMMIT. Availability and creation are one atomic step; there is no
 * moment in which a caller has "checked" availability and not yet taken it.
 *
 * Nothing else in this codebase may INSERT INTO bookings. If you are looking for
 * a shortcut around this function, the shortcut is how the same spot gets sold
 * twice at 19:52 to two people standing at the same barrier.
 */
export async function createBooking(input: CreateBookingInput): Promise<CreatedBooking> {
  if (input.spots < 1) throw new DomainError("VALIDATION_FAILED");

  return db.transaction(async (tx) => {
    const parking = await lockParking(tx, input.parkingId);

    if (parking.status !== "ACTIVE") throw new DomainError("PARKING_NOT_BOOKABLE");
    if (parking.capacity === null || parking.capacity <= 0) {
      throw new DomainError("PARKING_NOT_BOOKABLE");
    }

    let window: { startsAt: Date; endsAt: Date };
    let eventPriceGr: number | null = null;
    const eventId = input.eventId ?? null;

    if (eventId) {
      const eventRows = await tx
        .select({ startsAt: events.startsAt, endsAt: events.endsAt })
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1);

      const event = eventRows[0];
      if (!event) throw new DomainError("EVENT_NOT_FOUND");
      window = eventBookingWindow(event);

      const declarationRows = await tx
        .select({ priceGr: eventParkingAvailability.priceGr })
        .from(eventParkingAvailability)
        .where(
          and(
            eq(eventParkingAvailability.eventId, eventId),
            eq(eventParkingAvailability.parkingId, parking.id),
          ),
        )
        .limit(1);

      eventPriceGr = declarationRows[0]?.priceGr ?? null;
    } else {
      if (!input.startsAt || !input.endsAt) throw new DomainError("VALIDATION_FAILED");
      window = { startsAt: input.startsAt, endsAt: input.endsAt };
      if (window.endsAt <= window.startsAt) throw new DomainError("VALIDATION_FAILED");
    }

    if (window.endsAt.getTime() <= Date.now()) throw new DomainError("WINDOW_IN_PAST");

    const limit = await resolveLimit(tx, parking, eventId, window);

    // Capacity is > 0 by now (checked above), so a zero limit means the host does
    // not offer this parking in this window at all — blacked out, outside the
    // schedule, or the event offer was never made / was taken back. That is not
    // "sold out": telling a driver the last spot just went would be a lie.
    if (limit === 0) throw new DomainError("NOT_AVAILABLE_IN_WINDOW");

    const taken = await countOccupied(tx, {
      parkingId: parking.id,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
    });

    if (limit - taken < input.spots) {
      // ROLLBACK. The 15-minute holds of other buyers are counted in `taken`, so
      // this is a real "no", not a "maybe".
      throw new DomainError("SLOT_TAKEN");
    }

    const quote = quotePrice({
      parking,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      spots: input.spots,
      eventPriceGr,
      isEvent: Boolean(eventId),
    });

    const split = await resolveCommissionSplit(tx, {
      parkingId: parking.id,
      ownerId: parking.ownerId,
      ownerType: parking.ownerType,
      priceGr: quote.priceGr,
    });

    const policyRows = await tx
      .select({ id: refundPolicies.id })
      .from(refundPolicies)
      .where(and(eq(refundPolicies.isDefault, true), lte(refundPolicies.validFrom, sql`now()`)))
      .orderBy(desc(refundPolicies.validFrom))
      .limit(1);

    const policy = policyRows[0];
    if (!policy) {
      throw new Error("No default refund policy is in force — run the seed before taking money.");
    }

    const code = generateBookingCode();

    const inserted = await tx
      .insert(bookings)
      .values({
        code,
        codeHash: hashBookingCode(code),
        parkingId: parking.id,
        userId: input.userId,
        eventId,
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        spots: input.spots,
        status: "PENDING",
        priceGr: quote.priceGr,
        commissionRatePct: split.ratePct,
        commissionGr: split.commissionGr,
        hostPayoutGr: split.hostPayoutGr,
        // Versioned policy, frozen: this booking is settled by the rules that
        // were on screen when it was bought, not the ones in force when it is
        // cancelled.
        refundPolicyId: policy.id,
        vehiclePlate: input.vehiclePlate ?? null,
        pendingExpiresAt: sql`now() + interval '${sql.raw(String(PENDING_TTL_MINUTES))} minutes'`,
      })
      .returning();

    const booking = inserted[0];
    if (!booking) throw new Error("Booking insert returned no row");

    return { booking, quote };
  });
}

/* -------------------------------------------------------------------------- */
/* Late webhook: money arrived, hold may already be gone                      */
/* -------------------------------------------------------------------------- */

export type ConfirmOutcome =
  | { outcome: "CONFIRMED"; booking: SelectBooking }
  | { outcome: "ALREADY_CONFIRMED"; booking: SelectBooking }
  /** Paid, but the spot is gone or the booking was cancelled: refund in full, immediately. */
  | { outcome: "REFUND_REQUIRED"; booking: SelectBooking; reason: "SLOT_TAKEN" | "CANCELLED" };

/**
 * The scenario from docs/PAYMENTS.md §3.2: the driver authorised BLIK at the
 * 899th second, the hold expired at the 900th, and `payment_intent.succeeded`
 * lands now. We re-check availability under the same lock the purchase used:
 *   still room  → CONFIRMED, late but honoured
 *   no room     → EXPIRED + full refund
 * What we never do is keep the money without a booking.
 */
export async function confirmPaidBooking(bookingId: string): Promise<ConfirmOutcome> {
  return db.transaction(async (tx) => {
    const preRows = await tx
      .select({ parkingId: bookings.parkingId })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    const pre = preRows[0];
    if (!pre) throw new DomainError("BOOKING_NOT_FOUND");

    // Same lock order as createBooking (parking, then booking) — anything else
    // is a deadlock waiting for a busy Saturday.
    const parking = await lockParking(tx, pre.parkingId);

    const bookingRows = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .for("update")
      .limit(1);

    const booking = bookingRows[0];
    if (!booking) throw new DomainError("BOOKING_NOT_FOUND");

    if (booking.status === "CONFIRMED" || booking.status === "USED") {
      return { outcome: "ALREADY_CONFIRMED", booking };
    }

    if (booking.status === "CANCELLED") {
      return { outcome: "REFUND_REQUIRED", booking, reason: "CANCELLED" };
    }

    const limit = await resolveLimit(tx, parking, booking.eventId, {
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
    });
    const taken = await countOccupied(tx, {
      parkingId: booking.parkingId,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      excludeBookingId: booking.id,
    });

    if (limit - taken < booking.spots) {
      const expired = await tx
        .update(bookings)
        .set({ status: "EXPIRED", pendingExpiresAt: null, updatedAt: sql`now()` })
        .where(eq(bookings.id, booking.id))
        .returning();

      return {
        outcome: "REFUND_REQUIRED",
        booking: expired[0] ?? booking,
        reason: "SLOT_TAKEN",
      };
    }

    const confirmed = await tx
      .update(bookings)
      .set({ status: "CONFIRMED", pendingExpiresAt: null, updatedAt: sql`now()` })
      .where(eq(bookings.id, booking.id))
      .returning();

    const row = confirmed[0];
    if (!row) throw new Error("Booking confirmation returned no row");
    return { outcome: "CONFIRMED", booking: row };
  });
}
