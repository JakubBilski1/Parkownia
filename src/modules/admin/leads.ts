import { and, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { tstz } from "@/db/time";
import { notFound } from "./errors";
import { decodeCursor, toPage, type Page } from "./pagination";
import { leadsQuerySchema, setLeadStatusSchema } from "./schemas";

export type LeadItem = {
  id: string;
  createdAt: Date;
  status: (typeof leads.$inferSelect)["status"];
  objectName: string | null;
  address: string;
  objectType: (typeof leads.$inferSelect)["objectType"];
  spotsDeclared: number | null;
  contactName: string;
  phone: string | null;
  email: string | null;
  contactPreference: (typeof leads.$inferSelect)["contactPreference"];
  estimatedRateGr: number | null;
  estimatedAnnualGrossGr: number | null;
  eventsInReach: number | null;
  walkMinutesEnea: number | null;
  walkMinutesMtp: number | null;
  marketingEmailConsent: boolean;
  marketingPhoneConsent: boolean;
  source: string | null;
};

const COLUMNS = {
  id: leads.id,
  createdAt: leads.createdAt,
  status: leads.status,
  objectName: leads.objectName,
  address: leads.address,
  objectType: leads.objectType,
  spotsDeclared: leads.spotsDeclared,
  contactName: leads.contactName,
  phone: leads.phone,
  email: leads.email,
  contactPreference: leads.contactPreference,
  estimatedRateGr: leads.estimatedRateGr,
  estimatedAnnualGrossGr: leads.estimatedAnnualGrossGr,
  eventsInReach: leads.eventsInReach,
  walkMinutesEnea: leads.walkMinutesEnea,
  walkMinutesMtp: leads.walkMinutesMtp,
  marketingEmailConsent: leads.marketingEmailConsent,
  marketingPhoneConsent: leads.marketingPhoneConsent,
  source: leads.source,
} as const;

/**
 * Newest first — the opposite of the moderation queue, and on purpose: a lead
 * decays. Somebody who filled the calculator an hour ago still remembers doing
 * it; the same person two weeks later does not.
 */
export async function listLeads(input: unknown): Promise<Page<LeadItem>> {
  const { status, q, limit, cursor: rawCursor } = leadsQuerySchema.parse(input);
  const cursor = decodeCursor(rawCursor);

  const rows = await db
    .select(COLUMNS)
    .from(leads)
    .where(
      and(
        status ? eq(leads.status, status) : undefined,
        q ? matches(q) : undefined,
        cursor
          ? sql`(${leads.createdAt}, ${leads.id}) < (${tstz(cursor.createdAt)}, ${cursor.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(desc(leads.createdAt), desc(leads.id))
    .limit(limit + 1);

  return toPage(rows, limit);
}

/** One search box over everything you would actually search a lead by. */
function matches(q: string) {
  const pattern = `%${q}%`;
  return or(
    sql`${leads.contactName} ILIKE ${pattern}`,
    sql`${leads.address} ILIKE ${pattern}`,
    sql`${leads.objectName} ILIKE ${pattern}`,
    sql`${leads.email}::text ILIKE ${pattern}`,
    // Digits only, so "600 100 200" finds a number stored as "600100200".
    sql`regexp_replace(coalesce(${leads.phone}, ''), '\\D', '', 'g') ILIKE ${`%${q.replace(/\D/g, "")}%`}`,
  );
}

/** How many leads nobody has touched yet — the number on the dashboard tile. */
export async function countNewLeads(): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(leads)
    .where(eq(leads.status, "NEW"));

  return row?.value ?? 0;
}

export async function setLeadStatus(input: unknown): Promise<{ id: string; contactName: string }> {
  const { leadId, status } = setLeadStatusSchema.parse(input);

  const [row] = await db
    .update(leads)
    .set({ status, updatedAt: sql`now()` })
    .where(eq(leads.id, leadId))
    .returning({ id: leads.id, contactName: leads.contactName });

  if (!row) throw notFound("Lead");
  return row;
}
