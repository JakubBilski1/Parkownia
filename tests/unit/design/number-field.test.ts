import { describe, expect, it } from "vitest";
import { normalizeDigits } from "@/components/ui/number-field";

/**
 * The landing's rate field showed "015" after someone typed 15 into a field
 * that read 0. It was a controlled `<input type="number">`: the DOM held "015",
 * Number("015") is 15, the parent state was already 15 from the keystroke
 * before, so React saw no change to the value prop and never rewrote the DOM.
 * The stale zero just sat there in front of the person doing the typing.
 *
 * tsc, eslint, the build and every unit test passed while it shipped, because
 * none of them look at what a field renders. These cases are the guard rail.
 */
describe("normalizeDigits", () => {
  it("drops a leading zero when real digits follow — the shipped bug", () => {
    expect(normalizeDigits("015")).toBe("15");
    expect(normalizeDigits("007")).toBe("7");
    expect(normalizeDigits("0000042")).toBe("42");
  });

  it("keeps a lone zero, so the field can read 0 instead of going blank", () => {
    expect(normalizeDigits("0")).toBe("0");
    expect(normalizeDigits("00")).toBe("0");
  });

  it("lets the field be genuinely empty while the caret is in it", () => {
    // Without this, clearing the field snaps it back to "0" and a new number
    // has to be typed around a zero that will not go away.
    expect(normalizeDigits("")).toBe("");
    expect(normalizeDigits("abc")).toBe("");
  });

  it("strips everything that is not a digit", () => {
    // Whole numbers only: these are spot counts and złoty, never grosze.
    expect(normalizeDigits("35 zł")).toBe("35");
    expect(normalizeDigits("1 200")).toBe("1200");
    expect(normalizeDigits("-5")).toBe("5");
    expect(normalizeDigits("12,5")).toBe("125");
    expect(normalizeDigits("1e3")).toBe("13");
  });
});
