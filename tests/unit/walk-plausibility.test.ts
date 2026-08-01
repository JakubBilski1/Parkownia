import { describe, expect, it } from "vitest";
import {
  estimateWalk,
  formatDistanceAway,
  isWalkable,
  WALK_PLAUSIBLE_MAX_MINUTES,
} from "@/lib/format";

/**
 * A pin once told somebody "265 min".
 *
 * With no event picked, walk times are measured from the driver's own position,
 * and theirs was 21 km away. The arithmetic was right and the label was useless:
 * a 60 px pin has room for one fact, and "four and a half hours on foot" is not
 * the fact. Nobody walks to a match from another town.
 */
describe("walk plausibility", () => {
  it("calls a walk across the stadium car park walkable", () => {
    expect(isWalkable(300)).toBe(true);
  });

  it("still calls a genuine twenty-minute walk walkable", () => {
    // 1.5 km straight line ≈ 2 km detoured ≈ 24 min. People do this to save money.
    expect(isWalkable(1500)).toBe(true);
  });

  it("refuses the 21 km that produced 265 min", () => {
    const meters = 21_000;
    expect(estimateWalk(meters).minutes).toBeGreaterThan(WALK_PLAUSIBLE_MAX_MINUTES);
    expect(isWalkable(meters)).toBe(false);
  });

  it("draws the line where the constant says, not somewhere near it", () => {
    // Walk straight through the boundary a metre at a time and check it flips
    // exactly once, at the minute the constant names.
    let flips = 0;
    let previous = isWalkable(0);
    for (let meters = 0; meters <= 12_000; meters += 25) {
      const now = isWalkable(meters);
      if (now !== previous) {
        flips += 1;
        expect(estimateWalk(meters).minutes).toBe(WALK_PLAUSIBLE_MAX_MINUTES + 1);
      }
      previous = now;
    }
    expect(flips).toBe(1);
  });

  it("states distance without claiming anybody would walk it", () => {
    const label = formatDistanceAway(21_000);
    expect(label).toContain("21");
    expect(label).toContain("km");
    expect(label).not.toContain("pieszo");
    expect(label).not.toContain("min");
  });

  it("keeps metres readable close in", () => {
    expect(formatDistanceAway(240)).toBe("ok. 240 m stąd");
  });
});
