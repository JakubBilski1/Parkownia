import { sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimited } from "./api";

/**
 * Rate limiting without Redis (docs/ARCHITECTURE.md §6): the `rate_limits` table
 * holds one row per key. The table shape (key, window_start, count) buys a fixed
 * window, not a rolling bucket — a caller can spend the whole budget at the end
 * of one window and again at the start of the next. At MVP volumes that is an
 * accepted trade; the swap to Redis replaces this file, not its callers.
 *
 * Cleanup of stale rows belongs to the cron module (integration point).
 */

export type RateLimitVerdict = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * The shape `db.execute()` actually returns, which is not the shape the schema
 * suggests: it runs through postgres-js `unsafe()`, and that path skips the
 * driver's type parsers. A `timestamptz` therefore arrives as the raw string
 * Postgres printed ("2026-07-14 17:23:03.149913+02"), never as a Date — calling
 * `.getTime()` on it threw a TypeError and turned every rate-limited endpoint
 * (the map, login, /bookings, /payments/intent, every /scan/*) into a 500.
 *
 * So the window never crosses the boundary as a timestamp at all: SQL returns
 * epoch seconds as float8, which the driver does parse into a number.
 */
type RateLimitRow = {
  count: number;
  window_start_epoch: number;
};

export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitVerdict> {
  // The window is built as text -> interval rather than make_interval(secs => $1):
  // a bare parameter in a named-argument call leans on type inference, and this
  // query must not be one Postgres upgrade away from "could not determine data type".
  const window = sql`(${String(windowSeconds)} || ' seconds')::interval`;

  const rows = (await db.execute(sql`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limits.window_start <= now() - ${window}
        THEN 1
        ELSE rate_limits.count + 1
      END,
      window_start = CASE
        WHEN rate_limits.window_start <= now() - ${window}
        THEN now()
        ELSE rate_limits.window_start
      END,
      updated_at = now()
    RETURNING
      rate_limits.count AS count,
      EXTRACT(EPOCH FROM rate_limits.window_start)::float8 AS window_start_epoch
  `)) as unknown as RateLimitRow[];

  const row = rows[0];
  if (!row) {
    // A rate limiter that fails closed would lock everybody out of login the
    // moment the table misbehaves. Fail open, loudly.
    console.error("[rate-limit] no row returned; allowing the request");
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
  }

  return {
    allowed: row.count <= limit,
    remaining: Math.max(0, limit - row.count),
    retryAfterSeconds: retryAfterSeconds(
      new Date(row.window_start_epoch * 1000),
      windowSeconds,
    ),
  };
}

/** Seconds until the window rolls over. Never 0 — "retry after 0 s" is not advice. */
export function retryAfterSeconds(
  windowStart: Date,
  windowSeconds: number,
  now: Date = new Date(),
): number {
  const resetsAt = windowStart.getTime() + windowSeconds * 1000;
  return Math.max(1, Math.ceil((resetsAt - now.getTime()) / 1000));
}

/** Throws a 429 AppError (with Retry-After) when the budget is spent. */
export async function enforceRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const verdict = await consumeRateLimit(key, limit, windowSeconds);
  if (!verdict.allowed) {
    throw rateLimited(verdict.retryAfterSeconds);
  }
}

/**
 * Client IP behind Coolify/Traefik. `x-forwarded-for` is spoofable when nothing
 * strips it, so the reverse proxy must overwrite it — that is a deployment
 * requirement, not something this function can enforce.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return req.headers.get("x-real-ip")?.trim() ?? "unknown";
}
