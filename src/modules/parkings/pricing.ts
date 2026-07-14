import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { eventParkingAvailability, events, parkings } from "@/db/schema";
import { ApiError } from "./errors";

/**
 * Prices are computed here and nowhere else. Nothing in this file reads an amount
 * from a client payload — the driver's browser sends what they want to book, never
 * what it should cost (CLAUDE.md, docs/API_SPEC.md §5).
 */

export type PricingRules = {
  pricePerHourGr: number | null;
  pricePerDayGr: number | null;
  pricePerEventGr: number | null;
  minBookingMinutes: number;
  freeMinutes: number;
};

export type QuoteLineKind = "HOUR" | "DAY" | "EVENT";

export type QuoteLine = {
  kind: QuoteLineKind;
  count: number;
  unitPriceGr: number;
  amountGr: number;
};

export type PriceQuote = {
  /** Total charged, all spots included. Integer grosze. */
  priceGr: number;
  /** Charge for a single spot. */
  spotPriceGr: number;
  spots: number;
  durationMinutes: number;
  billedMinutes: number;
  freeMinutes: number;
  lines: QuoteLine[];
};

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * 60;

export function durationMinutes(startsAt: Date, endsAt: Date): number {
  return Math.ceil((endsAt.getTime() - startsAt.getTime()) / 60_000);
}

type Candidate = { total: number; lines: QuoteLine[] };

function hourlyCandidate(rules: PricingRules, minutes: number): Candidate | null {
  if (rules.pricePerHourGr === null) return null;
  const hours = Math.ceil(minutes / MINUTES_PER_HOUR);
  return {
    total: hours * rules.pricePerHourGr,
    lines: [
      {
        kind: "HOUR",
        count: hours,
        unitPriceGr: rules.pricePerHourGr,
        amountGr: hours * rules.pricePerHourGr,
      },
    ],
  };
}

function dailyCandidate(rules: PricingRules, minutes: number): Candidate | null {
  if (rules.pricePerDayGr === null) return null;
  const days = Math.ceil(minutes / MINUTES_PER_DAY);
  return {
    total: days * rules.pricePerDayGr,
    lines: [
      {
        kind: "DAY",
        count: days,
        unitPriceGr: rules.pricePerDayGr,
        amountGr: days * rules.pricePerDayGr,
      },
    ],
  };
}

function mixedCandidate(rules: PricingRules, minutes: number): Candidate | null {
  const { pricePerDayGr, pricePerHourGr } = rules;
  if (pricePerDayGr === null || pricePerHourGr === null) return null;

  const fullDays = Math.floor(minutes / MINUTES_PER_DAY);
  const restMinutes = minutes - fullDays * MINUTES_PER_DAY;
  if (fullDays === 0 || restMinutes === 0) return null;

  const restHours = Math.ceil(restMinutes / MINUTES_PER_HOUR);
  const daysAmount = fullDays * pricePerDayGr;
  const hoursAmount = restHours * pricePerHourGr;

  return {
    total: daysAmount + hoursAmount,
    lines: [
      { kind: "DAY", count: fullDays, unitPriceGr: pricePerDayGr, amountGr: daysAmount },
      { kind: "HOUR", count: restHours, unitPriceGr: pricePerHourGr, amountGr: hoursAmount },
    ],
  };
}

/**
 * Every tariff the parking offers is priced, and the driver is charged the cheapest
 * of them. A 26-hour stay must not cost 26 hourly rates when the host also set a
 * daily rate — that is the kind of surprise that ends a marketplace.
 */
export function quoteDuration(
  rules: PricingRules,
  startsAt: Date,
  endsAt: Date,
  spots = 1,
): PriceQuote {
  const total = durationMinutes(startsAt, endsAt);

  if (total <= 0) {
    throw new ApiError("UNPROCESSABLE", "Koniec rezerwacji musi być późniejszy niż początek.");
  }
  if (total < rules.minBookingMinutes) {
    throw new ApiError(
      "UNPROCESSABLE",
      `Ten parking rezerwuje się na minimum ${rules.minBookingMinutes} minut.`,
    );
  }

  const billed = Math.max(0, total - rules.freeMinutes);

  if (billed === 0) {
    return {
      priceGr: 0,
      spotPriceGr: 0,
      spots,
      durationMinutes: total,
      billedMinutes: 0,
      freeMinutes: rules.freeMinutes,
      lines: [],
    };
  }

  const candidates = [
    hourlyCandidate(rules, billed),
    dailyCandidate(rules, billed),
    mixedCandidate(rules, billed),
  ].filter((candidate): candidate is Candidate => candidate !== null);

  if (candidates.length === 0) {
    throw new ApiError(
      "UNPROCESSABLE",
      "Ten parking nie ma ceny godzinowej ani dobowej — nie da się go zarezerwować na wybrany czas.",
    );
  }

  const best = candidates.reduce((cheapest, candidate) =>
    candidate.total < cheapest.total ? candidate : cheapest,
  );

  return {
    priceGr: best.total * spots,
    spotPriceGr: best.total,
    spots,
    durationMinutes: total,
    billedMinutes: billed,
    freeMinutes: rules.freeMinutes,
    lines: best.lines,
  };
}

/**
 * The host's per-event declaration wins over the parking's default event price
 * (docs/DATA_MODEL.md §4): "50 zł na Lecha" is a decision about one match, and it
 * must not be overwritten by the generic tariff.
 */
export function quoteEvent(
  rules: Pick<PricingRules, "pricePerEventGr">,
  eventPriceGr: number | null | undefined,
  startsAt: Date,
  endsAt: Date,
  spots = 1,
): PriceQuote {
  const unitPrice = eventPriceGr ?? rules.pricePerEventGr;

  if (unitPrice === null || unitPrice === undefined) {
    throw new ApiError(
      "UNPROCESSABLE",
      "Ten parking nie ma ceny na to wydarzenie. Host musi ją ustawić przed sprzedażą.",
    );
  }

  const total = durationMinutes(startsAt, endsAt);

  return {
    priceGr: unitPrice * spots,
    spotPriceGr: unitPrice,
    spots,
    durationMinutes: Math.max(total, 0),
    billedMinutes: Math.max(total, 0),
    freeMinutes: 0,
    lines: [{ kind: "EVENT", count: 1, unitPriceGr: unitPrice, amountGr: unitPrice }],
  };
}

export type QuoteRequest = {
  parkingId: string;
  spots?: number;
  eventId?: string;
  startsAt?: Date;
  endsAt?: Date;
};

/**
 * A driver does not arrive at kick-off and leave at the final whistle. The window
 * they really occupy is the event plus an arrival and exit buffer, and that is the
 * window both the price and the availability check are computed against.
 */
export const EVENT_BUFFER_MINUTES = 120;

/**
 * INTEGRATION: the same two instants under two names. `from`/`to` is what the
 * availability resolver takes (src/modules/parkings/availability.ts, type Window);
 * `startsAt`/`endsAt` is what the bookings row is called. Both are returned so the
 * events and bookings modules can consume this without an adapter. Collapse to one
 * pair once the modules are wired together.
 */
export type EventBookingWindow = {
  from: Date;
  to: Date;
  startsAt: Date;
  endsAt: Date;
};

export function eventBookingWindow(event: {
  startsAt: Date;
  endsAt: Date;
}): EventBookingWindow {
  const from = new Date(event.startsAt.getTime() - EVENT_BUFFER_MINUTES * 60_000);
  const to = new Date(event.endsAt.getTime() + EVENT_BUFFER_MINUTES * 60_000);
  return { from, to, startsAt: from, endsAt: to };
}

/**
 * The only entry point other modules should use: it loads the tariff from the
 * database, so no caller can pass in a price of its own.
 */
export async function quoteBooking(request: QuoteRequest): Promise<PriceQuote> {
  const spots = request.spots ?? 1;

  const [parking] = await db
    .select({
      pricePerHourGr: parkings.pricePerHourGr,
      pricePerDayGr: parkings.pricePerDayGr,
      pricePerEventGr: parkings.pricePerEventGr,
      minBookingMinutes: parkings.minBookingMinutes,
      freeMinutes: parkings.freeMinutes,
    })
    .from(parkings)
    .where(eq(parkings.id, request.parkingId))
    .limit(1);

  if (!parking) {
    throw new ApiError("NOT_FOUND", "Nie znaleźliśmy tego parkingu.");
  }

  if (request.eventId) {
    const [row] = await db
      .select({
        startsAt: events.startsAt,
        endsAt: events.endsAt,
        priceGr: eventParkingAvailability.priceGr,
        isAvailable: eventParkingAvailability.isAvailable,
      })
      .from(events)
      .leftJoin(
        eventParkingAvailability,
        and(
          eq(eventParkingAvailability.eventId, events.id),
          eq(eventParkingAvailability.parkingId, request.parkingId),
        ),
      )
      .where(eq(events.id, request.eventId))
      .limit(1);

    if (!row) {
      throw new ApiError("NOT_FOUND", "Nie znaleźliśmy tego wydarzenia.");
    }

    const window = eventBookingWindow(row);
    return quoteEvent(parking, row.priceGr, window.startsAt, window.endsAt, spots);
  }

  if (!request.startsAt || !request.endsAt) {
    throw new ApiError("VALIDATION", "Podaj wydarzenie albo początek i koniec rezerwacji.");
  }

  return quoteDuration(parking, request.startsAt, request.endsAt, spots);
}
