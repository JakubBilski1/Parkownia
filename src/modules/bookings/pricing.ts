import { DomainError } from "./errors";

/**
 * Arrival and departure buffer around an event. The driver parks before kick-off
 * and leaves after the final whistle — the booking window is the event window
 * widened by these, so a host who declared a spot for the match cannot have it
 * resold to someone else half an hour before it.
 */
export const EVENT_ARRIVAL_BUFFER_MIN = 120;
export const EVENT_DEPARTURE_BUFFER_MIN = 120;

const MINUTE_MS = 60_000;

export function eventBookingWindow(event: { startsAt: Date; endsAt: Date }): {
  startsAt: Date;
  endsAt: Date;
} {
  return {
    startsAt: new Date(event.startsAt.getTime() - EVENT_ARRIVAL_BUFFER_MIN * MINUTE_MS),
    endsAt: new Date(event.endsAt.getTime() + EVENT_DEPARTURE_BUFFER_MIN * MINUTE_MS),
  };
}

export type PricingParking = {
  pricePerHourGr: number | null;
  pricePerDayGr: number | null;
  pricePerEventGr: number | null;
  minBookingMinutes: number;
  freeMinutes: number;
};

export type PriceQuote = {
  priceGr: number;
  unitPriceGr: number;
  basis: "EVENT" | "HOUR" | "DAY";
  spots: number;
};

/**
 * The only place a price is produced. The client never sends an amount and the
 * API contract has no field for one (docs/PAYMENTS.md §5).
 */
export function quotePrice(input: {
  parking: PricingParking;
  startsAt: Date;
  endsAt: Date;
  spots: number;
  /** event_parking_availability.price_gr — the host's price for this one event. */
  eventPriceGr?: number | null;
  isEvent: boolean;
}): PriceQuote {
  const { parking, startsAt, endsAt, spots } = input;

  if (input.isEvent) {
    const unitPriceGr = input.eventPriceGr ?? parking.pricePerEventGr;
    if (unitPriceGr === null || unitPriceGr === undefined || unitPriceGr <= 0) {
      throw new DomainError("PRICE_UNAVAILABLE");
    }
    return { priceGr: unitPriceGr * spots, unitPriceGr, basis: "EVENT", spots };
  }

  const durationMin = Math.round((endsAt.getTime() - startsAt.getTime()) / MINUTE_MS);
  if (durationMin < parking.minBookingMinutes) {
    throw new DomainError("MIN_DURATION", {
      message: `Ten parking rezerwuje się na minimum ${parking.minBookingMinutes} minut.`,
    });
  }

  // free_minutes shortens what is charged; it never makes a paid reservation
  // free. A reservation always costs at least one billing unit.
  const chargeableMin = Math.max(0, durationMin - parking.freeMinutes);

  const candidates: number[] = [];
  if (parking.pricePerHourGr !== null && parking.pricePerHourGr > 0) {
    candidates.push(Math.max(1, Math.ceil(chargeableMin / 60)) * parking.pricePerHourGr);
  }
  if (parking.pricePerDayGr !== null && parking.pricePerDayGr > 0) {
    candidates.push(Math.max(1, Math.ceil(chargeableMin / 1440)) * parking.pricePerDayGr);
  }

  if (candidates.length === 0) {
    throw new DomainError("PRICE_UNAVAILABLE");
  }

  // Cheapest applicable tariff wins: an 18-hour stay is billed as a day, not as
  // 18 hours. The driver never pays more than the daily rate for a single day.
  const unitPriceGr = Math.min(...candidates);
  const basis =
    parking.pricePerDayGr !== null &&
    parking.pricePerDayGr > 0 &&
    unitPriceGr === Math.max(1, Math.ceil(chargeableMin / 1440)) * parking.pricePerDayGr
      ? "DAY"
      : "HOUR";

  return { priceGr: unitPriceGr * spots, unitPriceGr, basis, spots };
}
