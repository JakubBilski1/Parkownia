import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A guard rail bought with a failed production deploy.
 *
 * `geographyPoint` (src/db/geo.ts) reports its SQL type as `geography(Point,4326)`.
 * drizzle-kit used to emit that verbatim — migration 0000 has
 * `"location" geography(Point,4326)` — but a later version started wrapping custom
 * type names in double quotes, and produced
 *
 *   "location" "geography(Point,4326)"
 *
 * in migration 0003. Quoted, that is one literal identifier, so Postgres looks for
 * a type actually NAMED `geography(Point,4326)` and answers 42704: type does not
 * exist. The container died in docker-entrypoint before serving a request, Coolify
 * rolled back to the previous image, and production silently stayed five days
 * behind main while every local check was green — none of them reads the generated
 * SQL.
 *
 * `"citext"` is fine and deliberately allowed: a quoted plain name still resolves.
 * Only a PARAMETERISED type breaks, so that is what this looks for.
 */

const MIGRATIONS_DIR = resolve(__dirname, "../../../drizzle");

/** e.g. "geography(Point,4326)" — a quoted identifier carrying an argument list. */
const QUOTED_PARAMETERISED_TYPE = /"[a-z_]+\s*\([^"]*\)"/gi;

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

describe("generated migrations", () => {
  it("has migrations to check at all", () => {
    expect(migrationFiles().length).toBeGreaterThan(0);
  });

  it.each(migrationFiles())("%s quotes no parameterised type", (file) => {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), "utf8");
    const offenders = sql.match(QUOTED_PARAMETERISED_TYPE) ?? [];

    expect(
      offenders,
      `${file} declares a column as ${offenders[0]} — quoted, Postgres reads that as a type NAME ` +
        `and fails with 42704. Drop the double quotes around the type (see drizzle/0000: ` +
        `geography(Point,4326) unquoted).`,
    ).toEqual([]);
  });

  it("keeps every geography column unquoted", () => {
    for (const file of migrationFiles()) {
      const sql = readFileSync(resolve(MIGRATIONS_DIR, file), "utf8");
      expect(sql, file).not.toMatch(/"geography\(/i);
    }
  });

  /**
   * The second trap in the same machinery. drizzle's migrator runs EVERY pending
   * migration inside ONE transaction (node_modules/drizzle-orm/pg-core/dialect.js:
   * `session.transaction(...)` wraps the whole loop). Postgres allows
   * `ALTER TYPE … ADD VALUE` in a transaction, but forbids USING the new value in
   * that same transaction — so a migration that adds an enum value and any later
   * migration that inserts or compares it will pass on a database that already had
   * the value and fail on a fresh one, where both are pending together.
   *
   * The fix, when this trips: put the data change in a separate deploy, or write
   * the value as text with an explicit cast in a statement that runs after commit.
   */
  it("never uses an enum value that a migration adds", () => {
    const files = migrationFiles();
    const added = new Map<string, string>();

    for (const file of files) {
      const sql = readFileSync(resolve(MIGRATIONS_DIR, file), "utf8");
      for (const match of sql.matchAll(/ADD\s+VALUE\s+'([^']+)'/gi)) {
        added.set(match[1]!, file);
      }
    }

    for (const [value, addedIn] of added) {
      for (const file of files) {
        const sql = readFileSync(resolve(MIGRATIONS_DIR, file), "utf8");
        const uses = sql
          .split("\n")
          .filter((line) => line.includes(`'${value}'`) && !/ADD\s+VALUE/i.test(line));

        expect(
          uses,
          `${file} uses the enum value '${value}' that ${addedIn} adds. Both run in one ` +
            `transaction on a fresh database, and Postgres refuses to use a value added in it.`,
        ).toEqual([]);
      }
    }
  });
});
