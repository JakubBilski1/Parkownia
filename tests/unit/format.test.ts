import { describe, expect, it } from "vitest";
import { formatSpots, pluralPl } from "@/lib/format";

/**
 * Polish plural is three-form, and the teens are the trap: 2/3/4 take the "few"
 * form but 12/13/14 do not. Getting this wrong is how the highest-leverage button
 * in the product ends up reading "Tak, 2 miejsc po 30 zł".
 */
describe("pluralPl", () => {
  const spots = (n: number) => pluralPl(n, "miejsce", "miejsca", "miejsc");

  it("uses the singular only for exactly 1", () => {
    expect(spots(1)).toBe("miejsce");
  });

  it("uses the 'few' form for 2-4", () => {
    expect(spots(2)).toBe("miejsca");
    expect(spots(3)).toBe("miejsca");
    expect(spots(4)).toBe("miejsca");
  });

  it("uses the 'many' form for 0 and 5-21", () => {
    expect(spots(0)).toBe("miejsc");
    expect(spots(5)).toBe("miejsc");
    expect(spots(11)).toBe("miejsc");
    expect(spots(21)).toBe("miejsc");
  });

  it("does NOT treat the teens as 'few' — 12/13/14 are 'many'", () => {
    expect(spots(12)).toBe("miejsc");
    expect(spots(13)).toBe("miejsc");
    expect(spots(14)).toBe("miejsc");
  });

  it("resumes the 'few' form above the teens: 22/23/24, 32…", () => {
    expect(spots(22)).toBe("miejsca");
    expect(spots(23)).toBe("miejsca");
    expect(spots(24)).toBe("miejsca");
    expect(spots(32)).toBe("miejsca");
    expect(spots(102)).toBe("miejsca");
  });

  it("keeps 25-31 and 112-114 in the 'many' form", () => {
    expect(spots(25)).toBe("miejsc");
    expect(spots(31)).toBe("miejsc");
    expect(spots(112)).toBe("miejsc");
    expect(spots(113)).toBe("miejsc");
  });
});

describe("formatSpots", () => {
  it("renders the count with the right form", () => {
    expect(formatSpots(1)).toBe("1 miejsce");
    expect(formatSpots(3)).toBe("3 miejsca");
    expect(formatSpots(5)).toBe("5 miejsc");
    expect(formatSpots(12)).toBe("12 miejsc");
    expect(formatSpots(22)).toBe("22 miejsca");
  });
});
