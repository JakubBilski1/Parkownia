import { describe, expect, it } from "vitest";
import type { WeeklySchedule } from "@/db/types";
import { isCoveredBySchedule } from "@/modules/bookings/schedule";

/** A company car park let out after office hours, and all weekend. */
const AFTER_WORK: WeeklySchedule = {
  mon: [{ from: "17:00", to: "24:00" }],
  fri: [{ from: "17:00", to: "24:00" }],
  sat: [{ from: "00:00", to: "24:00" }],
  sun: [{ from: "00:00", to: "12:00" }],
};

/** Warsaw is UTC+2 in July. 19:00 local is 17:00Z. */
const local = (iso: string) => new Date(iso);

describe("isCoveredBySchedule", () => {
  it("accepts a window fully inside a declared slot", () => {
    // Mon 2026-07-27, 19:00–22:00 local = 17:00–20:00 UTC.
    expect(
      isCoveredBySchedule(AFTER_WORK, local("2026-07-27T17:00:00Z"), local("2026-07-27T20:00:00Z")),
    ).toBe(true);
  });

  it("rejects a window that starts before the host opens", () => {
    // Mon 16:00–19:00 local — the lot is still full of employees' cars.
    expect(
      isCoveredBySchedule(AFTER_WORK, local("2026-07-27T14:00:00Z"), local("2026-07-27T17:00:00Z")),
    ).toBe(false);
  });

  it("rejects a day the host never declared", () => {
    // Tuesday is not in the schedule at all.
    expect(
      isCoveredBySchedule(AFTER_WORK, local("2026-07-28T18:00:00Z"), local("2026-07-28T20:00:00Z")),
    ).toBe(false);
  });

  it("joins Friday night to Saturday: midnight is not a wall", () => {
    // Fri 22:00 → Sat 02:00 local. Two slots that touch at 24:00/00:00 are one
    // continuous window, and a car does not have to leave the lot at midnight.
    expect(
      isCoveredBySchedule(AFTER_WORK, local("2026-07-31T20:00:00Z"), local("2026-08-01T00:00:00Z")),
    ).toBe(true);
  });

  it("rejects a window that runs past the end of a slot", () => {
    // Sun 10:00–14:00 local; the host only offers until 12:00.
    expect(
      isCoveredBySchedule(AFTER_WORK, local("2026-08-02T08:00:00Z"), local("2026-08-02T12:00:00Z")),
    ).toBe(false);
  });

  it("treats a missing schedule as 'nothing is on sale'", () => {
    expect(
      isCoveredBySchedule(null, local("2026-07-27T18:00:00Z"), local("2026-07-27T20:00:00Z")),
    ).toBe(false);
    expect(
      isCoveredBySchedule({}, local("2026-07-27T18:00:00Z"), local("2026-07-27T20:00:00Z")),
    ).toBe(false);
  });

  it("holds across the winter DST switch, when a local day is 25 hours long", () => {
    // Sunday 2026-10-25: clocks go back at 03:00 local. The 00:00–12:00 Sunday
    // slot must still cover a 09:00–11:00 local booking (07:00–09:00Z, i.e. UTC+1).
    expect(
      isCoveredBySchedule(AFTER_WORK, local("2026-10-25T08:00:00Z"), local("2026-10-25T10:00:00Z")),
    ).toBe(true);
    // …and must still end at local noon (11:00Z in winter time), not an hour later.
    expect(
      isCoveredBySchedule(AFTER_WORK, local("2026-10-25T10:30:00Z"), local("2026-10-25T11:30:00Z")),
    ).toBe(false);
  });
});
