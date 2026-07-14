import { describe, expect, it } from "vitest";
import { DomainError } from "@/modules/bookings/errors";
import {
  EVENT_ARRIVAL_BUFFER_MIN,
  eventBookingWindow,
  quotePrice,
  type PricingParking,
} from "@/modules/bookings/pricing";

const base: PricingParking = {
  pricePerHourGr: 800,
  pricePerDayGr: 4000,
  pricePerEventGr: 3500,
  minBookingMinutes: 30,
  freeMinutes: 0,
};

const at = (iso: string) => new Date(iso);

describe("quotePrice", () => {
  it("charges the host's event price when the host set one", () => {
    const quote = quotePrice({
      parking: base,
      startsAt: at("2026-07-25T15:00:00Z"),
      endsAt: at("2026-07-25T22:00:00Z"),
      spots: 1,
      eventPriceGr: 3000,
      isEvent: true,
    });

    expect(quote).toMatchObject({ priceGr: 3000, basis: "EVENT" });
  });

  it("falls back to the parking's default event price", () => {
    const quote = quotePrice({
      parking: base,
      startsAt: at("2026-07-25T15:00:00Z"),
      endsAt: at("2026-07-25T22:00:00Z"),
      spots: 1,
      eventPriceGr: null,
      isEvent: true,
    });

    expect(quote.priceGr).toBe(3500);
  });

  it("refuses to sell an event spot with no price rather than guessing one", () => {
    expect(() =>
      quotePrice({
        parking: { ...base, pricePerEventGr: null },
        startsAt: at("2026-07-25T15:00:00Z"),
        endsAt: at("2026-07-25T22:00:00Z"),
        spots: 1,
        eventPriceGr: null,
        isEvent: true,
      }),
    ).toThrow(DomainError);
  });

  it("rounds hours up — 61 minutes is two hours", () => {
    const quote = quotePrice({
      parking: base,
      startsAt: at("2026-07-25T10:00:00Z"),
      endsAt: at("2026-07-25T11:01:00Z"),
      spots: 1,
      isEvent: false,
    });

    expect(quote).toMatchObject({ priceGr: 1600, basis: "HOUR" });
  });

  it("never charges more than the daily rate for a long stay", () => {
    // 18 hours × 8 zł = 144 zł hourly, but a day costs 40 zł.
    const quote = quotePrice({
      parking: base,
      startsAt: at("2026-07-25T06:00:00Z"),
      endsAt: at("2026-07-26T00:00:00Z"),
      spots: 1,
      isEvent: false,
    });

    expect(quote).toMatchObject({ priceGr: 4000, basis: "DAY" });
  });

  it("bills a 30-hour stay as two days", () => {
    const quote = quotePrice({
      parking: base,
      startsAt: at("2026-07-25T06:00:00Z"),
      endsAt: at("2026-07-26T12:00:00Z"),
      spots: 1,
      isEvent: false,
    });

    expect(quote.priceGr).toBe(8000);
  });

  it("multiplies by the number of spots", () => {
    const quote = quotePrice({
      parking: base,
      startsAt: at("2026-07-25T10:00:00Z"),
      endsAt: at("2026-07-25T12:00:00Z"),
      spots: 3,
      isEvent: false,
    });

    expect(quote.priceGr).toBe(4800);
  });

  it("lets free minutes shorten the bill but never zero it", () => {
    const quote = quotePrice({
      parking: { ...base, pricePerDayGr: null, freeMinutes: 60 },
      startsAt: at("2026-07-25T10:00:00Z"),
      endsAt: at("2026-07-25T10:45:00Z"),
      spots: 1,
      isEvent: false,
    });

    // 45 min − 60 free = 0 chargeable, but a paid reservation still costs one unit.
    expect(quote.priceGr).toBe(800);
  });

  it("enforces the parking's minimum booking length", () => {
    expect(() =>
      quotePrice({
        parking: { ...base, minBookingMinutes: 60 },
        startsAt: at("2026-07-25T10:00:00Z"),
        endsAt: at("2026-07-25T10:30:00Z"),
        spots: 1,
        isEvent: false,
      }),
    ).toThrow(/minimum 60 minut/);
  });

  it("refuses a parking with no tariff at all", () => {
    expect(() =>
      quotePrice({
        parking: { ...base, pricePerHourGr: null, pricePerDayGr: null },
        startsAt: at("2026-07-25T10:00:00Z"),
        endsAt: at("2026-07-25T12:00:00Z"),
        spots: 1,
        isEvent: false,
      }),
    ).toThrow(DomainError);
  });
});

describe("eventBookingWindow", () => {
  it("holds the spot from before kick-off until after the final whistle", () => {
    const window = eventBookingWindow({
      startsAt: at("2026-07-25T17:00:00Z"),
      endsAt: at("2026-07-25T19:00:00Z"),
    });

    expect(window.startsAt.toISOString()).toBe("2026-07-25T15:00:00.000Z");
    expect(window.endsAt.toISOString()).toBe("2026-07-25T21:00:00.000Z");
    expect(EVENT_ARRIVAL_BUFFER_MIN).toBe(120);
  });
});
