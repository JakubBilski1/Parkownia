import { loadEnv } from "vite";

/**
 * The integration suite runs against a real PostgreSQL + PostGIS. Which one is
 * decided here, in one place, because getting it wrong means running destructive
 * fixtures against the development database.
 *
 * `globalSetup` executes in Vitest's own process, where `test.env` from
 * vitest.config.ts has NOT been applied yet — that lands in the workers. So the
 * .env files are read here directly, exactly the way the config reads them.
 */
export function testDatabaseUrl(): string {
  const env = loadEnv("test", process.cwd(), "");
  const url = env.TEST_DATABASE_URL || process.env.TEST_DATABASE_URL || "";

  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set.\n" +
        "The integration suite needs a throwaway database — see tests/README.md.\n" +
        '  TEST_DATABASE_URL="postgresql://parkspot:parkspot@localhost:5433/parkspot_test"',
    );
  }

  const devUrl = env.DATABASE_URL || process.env.DATABASE_URL || "";
  if (devUrl && sameDatabase(url, devUrl)) {
    // These tests truncate their own fixtures and bulk-insert a few hundred
    // parkings to make the planner commit to the GiST index. Pointed at the
    // development database that is merely rude; pointed at anything else it is a
    // resume-generating event. The suite refuses rather than trusts.
    throw new Error(
      "TEST_DATABASE_URL points at the same database as DATABASE_URL.\n" +
        "The integration suite writes and deletes rows — it needs its own database.",
    );
  }

  return url;
}

function sameDatabase(a: string, b: string): boolean {
  try {
    const left = new URL(a);
    const right = new URL(b);
    return left.host === right.host && left.pathname === right.pathname;
  } catch {
    return a === b;
  }
}

/** `postgresql://user:pass@host:5432/parkspot_test` → `parkspot_test`. */
export function databaseName(url: string): string {
  return new URL(url).pathname.replace(/^\//, "");
}

/** The same server, but the maintenance database — used to CREATE DATABASE. */
export function maintenanceUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = "/postgres";
  return parsed.toString();
}
