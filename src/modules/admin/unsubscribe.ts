import { createHmac, randomBytes } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { emailCampaignRecipients, emailSuppressions } from "@/db/schema";
import type { EmailSuppressionReason } from "@/db/types";

/**
 * Unsubscribing, done so that it actually stops the next mail.
 *
 * The old footer was a `mailto:` — a request to a human, not a mechanism.
 * Somebody who "unsubscribed" that way stayed on every list we could paste, and
 * the only thing standing between them and the next campaign was whoever
 * remembered. This module is the mechanism: a link per recipient, and a table
 * `sendCampaign` subtracts before it writes a single row.
 *
 * The token follows the same rule as refresh and action tokens (see
 * modules/auth/action-tokens.ts): random bytes go out in the mail, only the HMAC
 * is stored. That keeps the address out of the URL — an unsubscribe link ends up
 * in inbox previews, proxies and browser history, and it should not carry
 * personal data through any of them.
 *
 * Deliberately NOT one-shot: a link that stops working after the first click is
 * a link that fails the second time somebody tries, and the second try is the
 * angry one. Unsubscribing twice is a no-op.
 */

function unsubscribeSecret(): string {
  // Shared with the e-mail action links: same trust level, same rotation.
  const secret = process.env.ACTION_TOKEN_SECRET;
  if (!secret) throw new Error("ACTION_TOKEN_SECRET is not set.");
  return secret;
}

export function hashUnsubscribeToken(token: string): string {
  return createHmac("sha256", unsubscribeSecret()).update(token).digest("hex");
}

export function newUnsubscribeToken(): string {
  return randomBytes(32).toString("base64url");
}

export function unsubscribeUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://parkownia.com").replace(/\/$/, "");
  return `${base}/wypisz/${token}`;
}

/* -------------------------------------------------------------------------- */
/* The list                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Which of these addresses may never be mailed again. Returns lowercase keys —
 * `email_suppressions.email` is citext, so the comparison is case-insensitive in
 * the database, but callers compare in JS afterwards and would otherwise miss
 * `Jan@Firma.pl`.
 */
export async function findSuppressed(emails: string[]): Promise<Set<string>> {
  if (emails.length === 0) return new Set();

  const rows = await db
    .select({ email: emailSuppressions.email })
    .from(emailSuppressions)
    .where(inArray(emailSuppressions.email, emails));

  return new Set(rows.map((row) => row.email.toLowerCase()));
}

export type SuppressionResult =
  /** The link was good; the address is now off the list (or already was). */
  | { ok: true; email: string; alreadyOff: boolean }
  /** No such token. A mangled link, or one from before this existed. */
  | { ok: false };

/**
 * Honour a click on the footer link. Idempotent by the unique index on `email`:
 * a second click, a mail scanner following the URL, and a forwarded link all
 * land on the same row.
 */
export async function unsubscribeByToken(token: string): Promise<SuppressionResult> {
  if (!token || token.length > 200) return { ok: false };

  const [recipient] = await db
    .select({
      email: emailCampaignRecipients.email,
      campaignId: emailCampaignRecipients.campaignId,
    })
    .from(emailCampaignRecipients)
    .where(eq(emailCampaignRecipients.unsubscribeTokenHash, hashUnsubscribeToken(token)))
    .limit(1);

  if (!recipient) return { ok: false };

  const inserted = await db
    .insert(emailSuppressions)
    .values({
      email: recipient.email,
      reason: "UNSUBSCRIBED",
      campaignId: recipient.campaignId,
    })
    .onConflictDoNothing({ target: emailSuppressions.email })
    .returning({ id: emailSuppressions.id });

  return { ok: true, email: recipient.email, alreadyOff: inserted.length === 0 };
}

/** Admin-side entry, for a complaint that arrives by phone or by reply. */
export async function suppress(
  email: string,
  reason: EmailSuppressionReason,
  note?: string,
): Promise<void> {
  await db
    .insert(emailSuppressions)
    .values({ email: email.trim().toLowerCase(), reason, note: note ?? null })
    .onConflictDoNothing({ target: emailSuppressions.email });
}
