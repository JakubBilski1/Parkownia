import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { consents } from "@/db/schema";
import type { ConsentKind } from "@/db/types";

/**
 * Consents are versioned and append-only (RODO): granting inserts a row,
 * withdrawing stamps `withdrawn_at` on the open one. We never delete — the
 * proof that consent was given, and when, and to which version of the document,
 * is the point of the table.
 *
 * Bump a version here when the wording of that document changes; the next
 * registration then records the new version, and old rows keep telling the
 * truth about what the user actually agreed to.
 */
export const CONSENT_VERSIONS: Record<ConsentKind, string> = {
  // Bumped 2026-08-01: the terms gained the waiting list and the map as named
  // electronic services and a paragraph on liability; the policy gained the
  // waiting list, technical data, mailing records, and corrected Stripe from a
  // live recipient to a future one. Rows written before that keep saying
  // 2026-07-01, which is the truth about what those people agreed to.
  TERMS: "2026-08-01",
  PRIVACY: "2026-08-01",
  MARKETING_EMAIL: "2026-07-01",
  MARKETING_SMS: "2026-07-01",
};

/** Terms and privacy are the condition of having an account, not a preference. */
export const MARKETING_KINDS = ["MARKETING_EMAIL", "MARKETING_SMS"] as const;
export type MarketingKind = (typeof MARKETING_KINDS)[number];

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ConsentState = {
  kind: ConsentKind;
  granted: boolean;
  documentVersion: string | null;
  grantedAt: Date | null;
  withdrawnAt: Date | null;
};

export async function grantConsent(
  userId: string,
  kind: ConsentKind,
  client: DbClient = db,
): Promise<void> {
  await client.insert(consents).values({
    userId,
    kind,
    documentVersion: CONSENT_VERSIONS[kind],
  });
}

export async function withdrawConsent(
  userId: string,
  kind: ConsentKind,
  client: DbClient = db,
): Promise<void> {
  const now = new Date();
  await client
    .update(consents)
    .set({ withdrawnAt: now, updatedAt: now })
    .where(
      and(
        eq(consents.userId, userId),
        eq(consents.kind, kind),
        isNull(consents.withdrawnAt),
      ),
    );
}

/** Current state per kind: the newest row wins. */
export async function listConsents(userId: string): Promise<ConsentState[]> {
  const rows = await db
    .select()
    .from(consents)
    .where(eq(consents.userId, userId))
    .orderBy(desc(consents.grantedAt));

  const kinds: ConsentKind[] = ["TERMS", "PRIVACY", "MARKETING_EMAIL", "MARKETING_SMS"];

  return kinds.map((kind) => {
    const latest = rows.find((row) => row.kind === kind);
    if (!latest) {
      return {
        kind,
        granted: false,
        documentVersion: null,
        grantedAt: null,
        withdrawnAt: null,
      };
    }

    return {
      kind,
      granted: latest.withdrawnAt === null,
      documentVersion: latest.documentVersion,
      grantedAt: latest.grantedAt,
      withdrawnAt: latest.withdrawnAt,
    };
  });
}

/** The API speaks camelCase; the table speaks enum kinds. One place to bridge them. */
const MARKETING_FIELD: Record<MarketingKind, "marketingEmail" | "marketingSms"> = {
  MARKETING_EMAIL: "marketingEmail",
  MARKETING_SMS: "marketingSms",
};

export type MarketingConsentInput = {
  marketingEmail?: boolean;
  marketingSms?: boolean;
};

/** Grants what is newly true, withdraws what is newly false. Idempotent. */
export async function setMarketingConsents(
  userId: string,
  next: MarketingConsentInput,
): Promise<ConsentState[]> {
  const current = await listConsents(userId);

  for (const kind of MARKETING_KINDS) {
    const wanted = next[MARKETING_FIELD[kind]];
    if (wanted === undefined) continue;

    const granted = current.find((state) => state.kind === kind)?.granted ?? false;
    if (wanted === granted) continue;

    if (wanted) {
      await grantConsent(userId, kind);
    } else {
      await withdrawConsent(userId, kind);
    }
  }

  return listConsents(userId);
}
