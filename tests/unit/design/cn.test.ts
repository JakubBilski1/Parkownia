import { describe, expect, it } from "vitest";
import { buttonVariants } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * Guards a bug that shipped silently: tailwind-merge did not know `text-lead`
 * was a font size, read it as a colour, and dropped `text-accent-ink` from the
 * accent button as a "conflict". The CTA then inherited --ink and measured
 * 2.09:1 against its own background — below the 4.5:1 floor DESIGN_PRINCIPLES §4
 * calls non-negotiable — while tsc, lint and every test stayed green, because
 * the damage was to a string.
 */

const SIZES = ["ui", "body", "lead", "h1", "h2", "h3"] as const;

describe("cn keeps a text colour when a font size follows it", () => {
  it.each(SIZES)("text-accent-ink survives text-%s", (size) => {
    const merged = cn("text-accent-ink", `text-${size}`);
    expect(merged).toContain("text-accent-ink");
    expect(merged).toContain(`text-${size}`);
  });

  it("still lets one font size override another", () => {
    expect(cn("text-body", "text-lead")).toBe("text-lead");
  });

  it("still lets one text colour override another", () => {
    expect(cn("text-ink", "text-accent-ink")).toBe("text-accent-ink");
  });
});

/**
 * Characterisation, not a wish: this is tailwind-merge behaving correctly, and it
 * bit us anyway. Tailwind's own `text-*` sizes carry a line-height, so a font size
 * is treated as conflicting with `leading-*` — and a size arriving later (from a
 * caller's className) silently deletes the leading set earlier in a base string.
 *
 * That shipped: the events grid set `leading-none` in its base and took the size
 * via className. The leading vanished, line-height fell back to the 1.5rem
 * inherited from <body>, and a 128px numeral rendered into a 24px box, clipped by
 * overflow-hidden into unreadable stumps. Pass size and leading as one class.
 */
describe("a font size cancels a preceding leading — pass them as one class", () => {
  it("drops leading-none when a size follows it", () => {
    expect(cn("leading-none", "text-[6.5rem]")).toBe("text-[6.5rem]");
  });

  it("keeps both when the size carries the leading", () => {
    expect(cn("leading-none", "text-[6.5rem]/none")).toContain("text-[6.5rem]/none");
  });
});

describe("every button variant keeps its text colour at every size", () => {
  const cases = [
    { variant: "accent", expected: "text-accent-ink" },
    { variant: "danger", expected: "text-danger" },
    { variant: "quiet", expected: "text-ink" },
    { variant: "ghost", expected: "text-ink" },
  ] as const;

  for (const { variant, expected } of cases) {
    for (const size of ["sm", "md", "lg"] as const) {
      it(`${variant} @ ${size} keeps ${expected}`, () => {
        // Through cn, exactly as Button and LinkButton render it. Asserting on
        // buttonVariants alone would prove nothing: cva only concatenates, so
        // the colour is always in that string — it is the merge that dropped it.
        expect(cn(buttonVariants({ variant, size }))).toContain(expected);
      });
    }
  }
});
