import { describe, expect, it } from "vitest";
import { DEFAULT_EVENT_PRICE_GR, suggestPriceGr, suggestSpots } from "@/modules/events/availability";
import { eventIdPrefixFromSlug, eventSlug, slugifyPl } from "@/modules/events/slug";
import { declareAvailabilitySchema, quickDeclareSchema } from "@/modules/events/validation";

const EVENT = {
  id: "a1b2c3d4-1111-4222-8333-444455556666",
  title: "Lech Poznań – Cracovia",
  startsAt: new Date("2026-07-25T18:00:00Z"),
};

describe("event slug", () => {
  it("transliterates Polish and keeps the id prefix resolvable", () => {
    const slug = eventSlug(EVENT);
    expect(slug).toBe("lech-poznan-cracovia-25-07-a1b2c3d4");
    expect(eventIdPrefixFromSlug(slug)).toBe("a1b2c3d4");
  });

  it("uses the Europe/Warsaw day, not the UTC one", () => {
    // 23:30 local on 31.10 is 22:30Z the same day; the label must not slip a day.
    const slug = eventSlug({ ...EVENT, startsAt: new Date("2026-10-31T22:30:00Z") });
    expect(slug).toContain("-31-10-");
  });

  it("rejects a slug without an id prefix", () => {
    expect(eventIdPrefixFromSlug("lech-poznan-cracovia")).toBeNull();
    expect(slugifyPl("Poznań Game Arena")).toBe("poznan-game-arena");
  });
});

describe("declaration suggestions", () => {
  it("prefers what the host already declared, then the parking's event price", () => {
    expect(suggestPriceGr(5000, 3000, 2000)).toBe(5000);
    expect(suggestPriceGr(null, 3000, 2000)).toBe(3000);
    expect(suggestPriceGr(null, null, 2000)).toBe(2000);
    expect(suggestPriceGr(null, null, null)).toBe(DEFAULT_EVENT_PRICE_GR);
  });

  it("offers the whole lot when the host never limited it", () => {
    expect(suggestSpots(50, 10)).toBe(10);
    expect(suggestSpots(50, null)).toBe(50);
    expect(suggestSpots(null, null)).toBe(1);
  });
});

describe("validation", () => {
  it("normalises nullable declaration fields", () => {
    const parsed = declareAvailabilitySchema.parse({
      parkingId: "a1b2c3d4-1111-4222-8333-444455556666",
      isAvailable: true,
      spots: 10,
      priceGr: 3000,
      notes: "   ",
    });

    expect(parsed).toEqual({
      parkingId: "a1b2c3d4-1111-4222-8333-444455556666",
      isAvailable: true,
      spots: 10,
      priceGr: 3000,
      notes: null,
    });
  });

  it("refuses a price outside the sane band — grosze, never złote", () => {
    const input = {
      parkingId: "a1b2c3d4-1111-4222-8333-444455556666",
      isAvailable: true,
      priceGr: 30,
    };
    expect(declareAvailabilitySchema.safeParse(input).success).toBe(false);
  });

  it("quick-declare takes a token and a boolean, nothing else", () => {
    const parsed = quickDeclareSchema.parse({
      token: "x".repeat(43),
      accept: true,
      // A client-supplied price must not survive validation into the domain.
      priceGr: 1,
    });
    expect(parsed).toEqual({ token: "x".repeat(43), accept: true });
  });
});
