import { sql, type SQL } from "drizzle-orm";

/**
 * A `Date` on its way into a raw `sql` template.
 *
 * Drizzle converts JS Dates for *columns* — `eq(bookings.startsAt, date)` works
 * because the column carries a mapper that knows it is a timestamptz. A Date
 * interpolated straight into a sql`` fragment has no column behind it, so it
 * reaches postgres-js as an unmapped parameter, and postgres-js refuses it:
 *
 *   TypeError [ERR_INVALID_ARG_TYPE]: The "string" argument must be of type
 *   string or an instance of Buffer or ArrayBuffer. Received an instance of Date
 *
 * That is a crash, not a wrong answer, and it took down every plain (non-event)
 * booking, the map's availability filter and the second page of every admin list
 * — none of which had ever been run against a real PostgreSQL.
 *
 * ISO-8601 with an explicit offset is unambiguous in any session time zone, and
 * the `::timestamptz` cast states the type instead of leaving Postgres to infer
 * it from context. Use this for every Date that crosses into raw SQL.
 */
export function tstz(value: Date): SQL {
  return sql`${value.toISOString()}::timestamptz`;
}
