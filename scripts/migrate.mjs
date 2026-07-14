// Applies the Drizzle migrations to DATABASE_URL.
//
// Plain ESM on purpose: the production image ships the Next.js standalone bundle
// and has no tsx, so a TypeScript runner could not be executed on the server.
// Local dev goes through the same file (`npm run db:migrate`), so there is one
// migration path, not two that can drift.
//
//   node --env-file=.env.local scripts/migrate.mjs   # local (npm run db:migrate)
//   docker-entrypoint.sh                             # VPS — runs on container
//                                                    # start, before the server
//                                                    # takes a request. Skip with
//                                                    # RUN_MIGRATIONS=false.

import { existsSync, readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const MIGRATIONS_FOLDER = process.env.MIGRATIONS_FOLDER ?? "./drizzle";
const EXTENSIONS_FILE = "./db/extensions.sql";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

if (!existsSync(`${MIGRATIONS_FOLDER}/meta/_journal.json`)) {
  console.error(`No migrations in ${MIGRATIONS_FOLDER} — run \`npm run db:generate\` first.`);
  process.exit(1);
}

// max: 1 — migrations must run on a single connection, in order.
const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  // The first migration creates geography columns and GiST indexes, so PostGIS has
  // to exist before it runs. On a managed database the app role often cannot create
  // extensions; say so plainly instead of failing inside an opaque migration.
  if (existsSync(EXTENSIONS_FILE)) {
    try {
      await sql.unsafe(readFileSync(EXTENSIONS_FILE, "utf8"));
    } catch (err) {
      console.error(
        `Could not create extensions: ${err.message}\n` +
          `Run \`psql "$DATABASE_URL" -f ${EXTENSIONS_FILE}\` as a superuser, then retry.`,
      );
      process.exit(1);
    }
  }

  await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_FOLDER });
  console.log("Migrations applied.");
} catch (err) {
  console.error("Migration failed:", err);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
