import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __parkspotSql: ReturnType<typeof postgres> | undefined;
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — copy .env.example to .env.local first.");
}

// A single pooled connection survives Next.js dev-server HMR reloads;
// without the global cache each reload would open a new pool.
const sql = globalThis.__parkspotSql ?? postgres(process.env.DATABASE_URL);

if (process.env.NODE_ENV !== "production") {
  globalThis.__parkspotSql = sql;
}

export const db = drizzle(sql, { schema });
