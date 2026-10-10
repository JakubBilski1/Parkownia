import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { databaseName, maintenanceUrl, testDatabaseUrl } from "./env";

/**
 * Brings the throwaway database to a state the application can actually run
 * against: extensions, schema, and the two reference tables without which
 * createBooking() refuses to take money (commission_rules, refund_policies).
 *
 * Runs once per `npm run test:integration`, and is idempotent — an existing,
 * already-migrated database costs a handful of no-op statements.
 */
export default async function setup(): Promise<void> {
  const url = testDatabaseUrl();

  await ensureDatabaseExists(url);

  const client = postgres(url, { max: 1, onnotice: () => {} });

  try {
    await client.unsafe("CREATE EXTENSION IF NOT EXISTS postgis");
    await client.unsafe("CREATE EXTENSION IF NOT EXISTS citext");
    await client.unsafe("CREATE EXTENSION IF NOT EXISTS pgcrypto");

    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });

    await ensureReferenceData(client);

    console.info(`[integration] database ready: ${databaseName(url)}`);
  } finally {
    await client.end();
  }
}

async function ensureDatabaseExists(url: string): Promise<void> {
  const name = databaseName(url);
  const admin = postgres(maintenanceUrl(url), { max: 1, onnotice: () => {} });

  try {
    const rows = await admin`SELECT 1 FROM pg_database WHERE datname = ${name}`;
    if (rows.length === 0) {
      // No parameters: CREATE DATABASE cannot be prepared. The name comes from
      // our own .env, not from anything a request could influence.
      await admin.unsafe(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
      console.info(`[integration] created database ${name}`);
    }
  } catch (error) {
    throw new Error(
      `Could not reach PostgreSQL to prepare "${name}": ${error instanceof Error ? error.message : error}\n` +
        "Is the database up? See tests/README.md.",
    );
  } finally {
    await admin.end();
  }
}

/**
 * The rules a booking is priced and settled by. The application treats a missing
 * commission rule or default refund policy as a reason to refuse the sale — which
 * is correct, and which would otherwise turn every test in this suite into the
 * same unhelpful failure.
 *
 * Fixture values: the 2026-01-01 seed rules (50% from individuals, 30% from
 * businesses) and 100/50/0 refunds. The suite asserts against these; production
 * has charged one 25% rate since 2026-10-10 (src/db/seed.ts).
 */
async function ensureReferenceData(client: postgres.Sql): Promise<void> {
  await client.unsafe(`
    INSERT INTO commission_rules (scope, rate_pct, valid_from)
    SELECT 'GLOBAL_INDIVIDUAL', 50, '2026-01-01T00:00:00Z'
     WHERE NOT EXISTS (SELECT 1 FROM commission_rules WHERE scope = 'GLOBAL_INDIVIDUAL')
  `);

  await client.unsafe(`
    INSERT INTO commission_rules (scope, rate_pct, valid_from)
    SELECT 'GLOBAL_BUSINESS', 30, '2026-01-01T00:00:00Z'
     WHERE NOT EXISTS (SELECT 1 FROM commission_rules WHERE scope = 'GLOBAL_BUSINESS')
  `);

  await client.unsafe(`
    INSERT INTO refund_policies (name, rules, is_default, valid_from)
    SELECT 'Standardowa',
           '[{"minHoursBefore":24,"refundPct":100},{"minHoursBefore":2,"refundPct":50},{"minHoursBefore":0,"refundPct":0}]'::jsonb,
           true,
           '2026-01-01T00:00:00Z'
     WHERE NOT EXISTS (SELECT 1 FROM refund_policies WHERE is_default)
  `);
}
