import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The dark palette lives twice in globals.css — once for the explicit toggle
 * (`:root[data-theme="dark"]`) and once for the OS preference (inside
 * `@media (prefers-color-scheme: dark)`). CSS cannot share one rule across a
 * media-query boundary, so the copies are duplicated by necessity.
 *
 * That duplication already shipped a bug: the accent was changed in the toggle
 * copy only, and because the OS copy used `:root:not([data-theme="light"])` —
 * which ALSO matches `data-theme="dark"`, ties on specificity (0,2,0) and sits
 * later in the file — it silently overrode the explicit toggle. Every user on a
 * dark OS kept the old accent, whichever theme they picked.
 *
 * These tests are the guard rail: the copies must declare identical tokens, and
 * the OS copy must not be able to outrank a deliberate choice.
 */

/**
 * Comments are stripped before anything is parsed or matched: prose about the
 * tokens ("...kept distinct from the danger/scan reds") otherwise parses as a
 * declaration, and prose about the bug would trip the regression checks below.
 */
const CSS = readFileSync(resolve(__dirname, "../../../src/app/globals.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** Declarations of the rule that starts at `selector`, brace-balanced. */
function readRule(selector: string): Map<string, string> {
  const start = CSS.indexOf(selector);
  expect(start, `selector not found in globals.css: ${selector}`).toBeGreaterThan(-1);

  let depth = 0;
  let end = -1;
  for (let i = CSS.indexOf("{", start); i < CSS.length; i += 1) {
    if (CSS[i] === "{") depth += 1;
    else if (CSS[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  expect(end, `unbalanced braces after ${selector}`).toBeGreaterThan(-1);

  const body = CSS.slice(CSS.indexOf("{", start) + 1, end);
  const declarations = new Map<string, string>();
  for (const match of body.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)) {
    const property = match[1];
    const value = match[2];
    if (!property || !value) continue;
    declarations.set(property.trim(), value.trim().replace(/\s+/g, " "));
  }
  return declarations;
}

const TOGGLE = ':root[data-theme="dark"]';
const SYSTEM = ":root:not([data-theme])";

describe("dark theme token copies", () => {
  it("declare exactly the same properties", () => {
    expect([...readRule(SYSTEM).keys()].sort()).toEqual([...readRule(TOGGLE).keys()].sort());
  });

  it("declare exactly the same values", () => {
    expect(Object.fromEntries(readRule(SYSTEM))).toEqual(Object.fromEntries(readRule(TOGGLE)));
  });

  it("are not empty — a silently renamed selector would pass the checks above", () => {
    expect(readRule(TOGGLE).size).toBeGreaterThan(10);
  });
});

describe("the OS-preference rule cannot outrank the explicit toggle", () => {
  it("matches only when no theme was chosen", () => {
    // `:not([data-theme="light"])` matches data-theme="dark" too. Same
    // specificity, declared later, so it wins — that is the shipped bug.
    expect(CSS).not.toContain(':root:not([data-theme="light"])');
    expect(CSS).toContain(SYSTEM);
  });
});

describe("the accent stays the brand's stamp red in both themes", () => {
  it("never falls back to the retired champagne", () => {
    expect(CSS.toLowerCase()).not.toContain("#e0c9a6");
  });

  it("keeps dark's accent distinct from the scanner's reject red", () => {
    // Both are reds on a near-black field. If they converge, a driver reads a
    // CTA as a rejection — DESIGN_SYSTEM.md §1 keeps safety colours off-brand.
    const accent = readRule(TOGGLE).get("--accent");
    expect(accent).toBeDefined();
    expect(accent).not.toBe("#b3261e");
  });
});
