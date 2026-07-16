import { describe, expect, it } from "vitest";
import { formatEventCountdownPL } from "@/lib/format";

/**
 * The hero on /wydarzenia sells the next event with this string, so it is read
 * before anything else on the page. Every case below is one where counting
 * elapsed hours instead of calendar days in Europe/Warsaw gives a wrong answer.
 */
describe("formatEventCountdownPL", () => {
  // 2026-07-25 20:00 Warsaw (CEST, UTC+2) — Lech – Cracovia.
  const start = "2026-07-25T18:00:00Z";
  const end = "2026-07-25T20:00:00Z";

  it("counts the days to kick-off", () => {
    expect(formatEventCountdownPL(start, end, "2026-07-16T12:00:00Z")).toBe("za 9 dni");
  });

  it("says dziś for later the same day", () => {
    // 08:00 Warsaw, kick-off 20:00 Warsaw — 12 hours out, but the same date.
    expect(formatEventCountdownPL(start, end, "2026-07-25T06:00:00Z")).toBe("dziś");
  });

  it("says jutro when the date flips, even one hour out", () => {
    // 23:30 Warsaw on the 25th; the event starts 00:30 Warsaw on the 26th.
    // An hours-based countdown would call this "dziś". The wall calendar rules.
    expect(
      formatEventCountdownPL("2026-07-25T22:30:00Z", "2026-07-26T00:30:00Z", "2026-07-25T21:30:00Z"),
    ).toBe("jutro");
  });

  it("says jutro when 25 hours out but only one date away", () => {
    // 00:30 Warsaw on the 25th → 01:30 Warsaw on the 26th. 25 h, still "jutro".
    expect(
      formatEventCountdownPL("2026-07-25T23:30:00Z", "2026-07-26T01:30:00Z", "2026-07-24T22:30:00Z"),
    ).toBe("jutro");
  });

  it("is not moved by the autumn DST switch", () => {
    // Poland falls back on 2026-10-25, so these two dates are 49 hours apart,
    // not 48. Counting hours and dividing by 24 would answer "za 2 dni" only by
    // luck here and would break at the boundary; calendar days are exact.
    expect(
      formatEventCountdownPL("2026-10-26T12:00:00Z", "2026-10-26T14:00:00Z", "2026-10-24T12:00:00Z"),
    ).toBe("za 2 dni");
  });

  it("reports an event already under way", () => {
    // listUpcomingEvents keeps events until endsAt passes, so the soonest event
    // can be a match in progress. "za 0 dni" would be a lie on the hero.
    expect(formatEventCountdownPL(start, end, "2026-07-25T19:00:00Z")).toBe("trwa teraz");
  });

  it("treats the exact start instant as under way, not as dziś", () => {
    expect(formatEventCountdownPL(start, end, start)).toBe("trwa teraz");
  });

  it("reports an event that has ended", () => {
    expect(formatEventCountdownPL(start, end, "2026-07-25T20:00:00Z")).toBe("zakończone");
  });

  it("declines dni correctly across the Polish plural forms", () => {
    const daysOut = (n: number) => {
      const from = new Date("2026-07-01T10:00:00Z");
      const to = new Date(from.getTime() + n * 86_400_000);
      return formatEventCountdownPL(to, new Date(to.getTime() + 3_600_000), from);
    };
    // 2 takes the "few" form, 5 and the teens take "many" — but for "dzień" both
    // are spelled "dni", so the only form that must never appear here is "dzień".
    expect(daysOut(2)).toBe("za 2 dni");
    expect(daysOut(5)).toBe("za 5 dni");
    expect(daysOut(13)).toBe("za 13 dni");
    expect(daysOut(22)).toBe("za 22 dni");
  });
});
