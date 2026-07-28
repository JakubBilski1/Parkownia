import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A source-level guard, in the spirit of tests/unit/db/migrations.test.ts,
 * because this bug is invisible on a developer machine and only appears in
 * production.
 *
 * /api/auth/refresh is where an expired session goes to be rotated, and it then
 * redirects the user onward. It used to build that redirect from
 * `req.nextUrl.origin`. On a laptop that is http://localhost:3001 and everything
 * looks right; inside the container behind Coolify's proxy it is
 * http://0.0.0.0:3000 — so production rotated the tokens correctly and then sent
 * the browser to an address that exists nowhere outside the container. Verified
 * live: a dead cookie on parkownia.com ended at https://0.0.0.0:3000/.
 *
 * A relative Location cannot have that failure mode: the browser resolves it
 * against the address it is already on, and no header has to be trusted to
 * construct it.
 */
/**
 * Comments are stripped first: the file explains the bug it is guarding
 * against, and prose about `NextResponse.redirect` would trip the check that
 * the code no longer calls it.
 */
const SOURCE = readFileSync(resolve(__dirname, "../../../src/app/api/auth/refresh/route.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("GET /api/auth/refresh redirects", () => {
  it("never builds a redirect from the origin the container is bound to", () => {
    expect(SOURCE).not.toContain("nextUrl.origin");
  });

  it("does not use NextResponse.redirect, which requires an absolute URL", () => {
    expect(SOURCE).not.toContain("NextResponse.redirect");
  });

  it("sends a relative Location, so the browser keeps the host it is on", () => {
    const locations = [...SOURCE.matchAll(/location:\s*(\w+|`[^`]*`|"[^"]*")/gi)].map(
      (match) => match[1],
    );
    expect(locations.length).toBeGreaterThan(0);
    for (const location of locations) {
      expect(location).not.toMatch(/^["`]https?:/);
    }
  });

  it("still refuses an absolute next, so the bounce cannot be an open redirect", () => {
    expect(SOURCE).toContain('raw.startsWith("/")');
    expect(SOURCE).toContain('raw.startsWith("//")');
  });
});
