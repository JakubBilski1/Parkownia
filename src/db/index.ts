import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __parkowniaSql: ReturnType<typeof postgres> | undefined;
}

type Db = PostgresJsDatabase<typeof schema>;

let instance: Db | undefined;

function connect(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set — copy .env.example to .env.local first.");
  }

  // A single pooled connection survives Next.js dev-server HMR reloads;
  // without the global cache each reload would open a new pool.
  const sql = globalThis.__parkowniaSql ?? postgres(url);

  if (process.env.NODE_ENV !== "production") {
    globalThis.__parkowniaSql = sql;
  }

  return drizzle(sql, { schema });
}

/**
 * Connects on first use, not on import. `docker build` runs `next build` with no
 * DATABASE_URL (Dockerfile), and Next imports every route module while collecting
 * page data — reading the variable at import time killed the whole build on the
 * first API route it touched, before rendering a single page. A missing variable
 * still fails loudly, just at the first query instead of at import.
 */
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    instance ??= connect();
    const value = Reflect.get(instance, prop);
    // Bound so callers may hold on to `db.transaction` etc. without losing `this`.
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
