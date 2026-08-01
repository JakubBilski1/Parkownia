import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  consents,
  emailCampaignRecipients,
  emailCampaigns,
  leads,
  users,
} from "@/db/schema";
import { getEmailProvider } from "@/modules/notifications";
import { invalidState, notFound } from "./errors";
import { campaignDraftSchema, campaignIdSchema, sendCampaignSchema } from "./schemas";
import {
  findSuppressed,
  hashUnsubscribeToken,
  newUnsubscribeToken,
  unsubscribeUrl,
} from "./unsubscribe";

/**
 * Bulk send from the admin panel: the operator pastes a list of addresses, writes
 * one message, sees it rendered, and sends it once.
 *
 * Three rules the code enforces rather than trusts:
 *
 *  1. Nothing the operator types becomes markup. The body is an array of plain
 *     paragraphs and the template wraps each one — so a stray "<" cannot break
 *     somebody's inbox, and nothing can be injected into the HTML we send.
 *  2. Every address is labelled with its marketing consent BEFORE the send, from
 *     `leads` and from `consents`. Sending to addresses without one requires an
 *     explicit declaration, and that declaration is stored with the campaign
 *     (PKE art. 398 — a claim made after the fact is worth nothing).
 *  3. Recipient rows are written before the first mail leaves. A crash halfway
 *     leaves PENDING rows, so the next attempt can see who already has it.
 */

/** A synchronous send has to finish inside one request. 200 is the agreed ceiling. */
export const MAX_RECIPIENTS = 200;

/**
 * The template has six paragraph slots. Not an array: the mail service renders
 * MJML + Handlebars and the templates are kept deliberately dumb — {{var}} and
 * {{#if bool}}, no loops (see modules/notifications/templates.ts).
 */
export const MAX_PARAGRAPHS = 6;

const CONCURRENCY = 4;

export type ConsentState = "GRANTED" | "MISSING" | "UNKNOWN";

export type ParsedRecipient = {
  email: string;
  name: string | null;
};

export type AnnotatedRecipient = ParsedRecipient & {
  consent: ConsentState;
  /** Where the consent (or its absence) comes from — shown to the operator. */
  source: "lead" | "user" | null;
};

export type RecipientParseResult = {
  recipients: ParsedRecipient[];
  /** Entries we could not read as an address, verbatim, so they can be fixed. */
  invalid: string[];
  /** How many duplicates were collapsed. */
  duplicates: number;
  /** True when the list was longer than MAX_RECIPIENTS and got cut. */
  truncated: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/;

/**
 * Reads the shapes a human actually pastes:
 *
 *   ["a@b.pl", "c@d.pl"]
 *   [{ "email": "a@b.pl", "name": "Jan" }]
 *   { "recipients": [...] }  |  { "emails": [...] }
 *
 * Everything else is reported rather than guessed at. Anything unreadable comes
 * back in `invalid` — silently dropping a row from a mailing list is how somebody
 * never gets the mail and nobody finds out.
 */
export function parseRecipients(raw: string): RecipientParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw invalidState(
      "To nie jest poprawny JSON. Oczekuję listy adresów, np. [\"jan@firma.pl\"] albo [{\"email\":\"jan@firma.pl\",\"name\":\"Jan\"}].",
    );
  }

  const list = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.recipients)
      ? parsed.recipients
      : isRecord(parsed) && Array.isArray(parsed.emails)
        ? parsed.emails
        : null;

  if (!list) {
    throw invalidState(
      "JSON jest poprawny, ale nie widzę w nim listy. Wklej tablicę adresów albo obiekt z polem „recipients”.",
    );
  }

  const invalid: string[] = [];
  const seen = new Map<string, ParsedRecipient>();
  let duplicates = 0;

  for (const entry of list) {
    const candidate = readEntry(entry);
    if (!candidate) {
      invalid.push(typeof entry === "string" ? entry : JSON.stringify(entry));
      continue;
    }

    const key = candidate.email.toLowerCase();
    if (seen.has(key)) {
      duplicates += 1;
      // A later row may carry the name the earlier one lacked.
      const existing = seen.get(key)!;
      if (!existing.name && candidate.name) existing.name = candidate.name;
      continue;
    }
    seen.set(key, candidate);
  }

  const all = [...seen.values()];

  return {
    recipients: all.slice(0, MAX_RECIPIENTS),
    invalid,
    duplicates,
    truncated: all.length > MAX_RECIPIENTS,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readEntry(entry: unknown): ParsedRecipient | null {
  if (typeof entry === "string") {
    const email = entry.trim().toLowerCase();
    return EMAIL_RE.test(email) ? { email, name: null } : null;
  }

  if (!isRecord(entry)) return null;

  const rawEmail = entry.email ?? entry.mail ?? entry["e-mail"];
  if (typeof rawEmail !== "string") return null;

  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return null;

  const rawName = entry.name ?? entry.imie ?? entry.contactName;
  const name = typeof rawName === "string" && rawName.trim() ? rawName.trim() : null;

  return { email, name };
}

/* -------------------------------------------------------------------------- */
/* Consent                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * What we know about each address. GRANTED needs a positive record: a lead that
 * ticked the marketing box, or a user with a live MARKETING_EMAIL consent. An
 * address we have never seen is UNKNOWN, not MISSING — the operator reads those
 * two differently, and conflating them would hide how cold a list really is.
 */
export async function annotateConsent(
  recipients: ParsedRecipient[],
): Promise<AnnotatedRecipient[]> {
  if (recipients.length === 0) return [];

  const emails = recipients.map((r) => r.email);

  const leadRows = await db
    .select({ email: leads.email, granted: leads.marketingEmailConsent })
    .from(leads)
    .where(inArray(leads.email, emails));

  const userRows = await db
    .select({
      email: users.email,
      granted: sql<boolean>`bool_or(${consents.id} IS NOT NULL)`,
    })
    .from(users)
    .leftJoin(
      consents,
      and(
        eq(consents.userId, users.id),
        eq(consents.kind, "MARKETING_EMAIL"),
        isNull(consents.withdrawnAt),
      ),
    )
    .where(and(inArray(users.email, emails), isNull(users.deletedAt)))
    .groupBy(users.email);

  const known = new Map<string, { granted: boolean; source: "lead" | "user" }>();

  for (const row of userRows) {
    known.set(row.email.toLowerCase(), { granted: row.granted === true, source: "user" });
  }
  // Leads win when both exist: the lead form is where the marketing box was ticked.
  for (const row of leadRows) {
    if (!row.email) continue;
    const key = row.email.toLowerCase();
    const existing = known.get(key);
    known.set(key, {
      granted: row.granted === true || existing?.granted === true,
      source: "lead",
    });
  }

  return recipients.map((recipient) => {
    const hit = known.get(recipient.email);
    if (!hit) return { ...recipient, consent: "UNKNOWN", source: null };
    return {
      ...recipient,
      consent: hit.granted ? "GRANTED" : "MISSING",
      source: hit.source,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* The message                                                                */
/* -------------------------------------------------------------------------- */

export type CampaignDraft = {
  subject: string;
  preheader?: string | undefined;
  heading: string;
  paragraphs: string[];
  ctaLabel?: string | undefined;
  ctaUrl?: string | undefined;
};

/** Blank line = new paragraph, the way anybody writing an e-mail expects. */
export function splitParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((block) => block.trim().replace(/\s*\n\s*/g, " "))
    .filter((block) => block.length > 0)
    .slice(0, MAX_PARAGRAPHS);
}

export function normalizeDraft(input: unknown): CampaignDraft {
  const data = campaignDraftSchema.parse(input);
  const paragraphs = splitParagraphs(data.body);

  if (paragraphs.length === 0) {
    throw invalidState("Treść jest pusta. Napisz choć jeden akapit.");
  }

  return {
    subject: data.subject,
    preheader: data.preheader,
    heading: data.heading,
    paragraphs,
    ctaLabel: data.ctaLabel,
    ctaUrl: data.ctaUrl,
  };
}

/**
 * The flat, display-ready variables the mail template interpolates. Six numbered
 * slots instead of a loop, and a boolean instead of a branch, because the template
 * only knows {{var}} and {{#if bool}} — same contract as every other template in
 * modules/notifications/templates.ts.
 *
 * The MJML source lives in docs/mail-templates/owner-campaign.mjml and has to be
 * pasted into the pbdevs dashboard as `owner-campaign`, with the subject line set
 * to {{subject}} so each campaign can carry its own.
 */
export function templateData(
  draft: CampaignDraft,
  recipient: { name: string | null; unsubscribeUrl: string },
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    subject: draft.subject,
    preheader: draft.preheader ?? draft.paragraphs[0]?.slice(0, 140) ?? "",
    heading: draft.heading,
    greeting: recipient.name ? `Dzień dobry, ${recipient.name}` : "Dzień dobry",
    hasCta: Boolean(draft.ctaLabel && draft.ctaUrl),
    ctaLabel: draft.ctaLabel ?? "",
    ctaUrl: draft.ctaUrl ?? "",
    // One link per recipient, so a click stops the next campaign by itself
    // (modules/admin/unsubscribe.ts). The mailto it replaced was a request to a
    // human and stopped nothing.
    unsubscribeUrl: recipient.unsubscribeUrl,
  };

  for (let i = 0; i < MAX_PARAGRAPHS; i += 1) {
    data[`p${i + 1}`] = draft.paragraphs[i] ?? "";
  }

  return data;
}

/* -------------------------------------------------------------------------- */
/* Sending                                                                    */
/* -------------------------------------------------------------------------- */

export type SendSummary = {
  campaignId: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  /** Addresses dropped because they had unsubscribed. Reported, never silent. */
  suppressedCount: number;
  /** Provider reasons, deduplicated — enough to act on, without a wall of text. */
  errors: string[];
};

export async function sendCampaign(input: unknown, adminUserId: string): Promise<SendSummary> {
  const parsed = sendCampaignSchema.parse(input);
  const draft = normalizeDraft(parsed);

  const { recipients: parsedRecipients, truncated } = parseRecipients(parsed.recipientsJson);
  if (parsedRecipients.length === 0) {
    throw invalidState("Lista adresatów jest pusta. Wklej listę i sprawdź ją przed wysyłką.");
  }
  if (truncated) {
    throw invalidState(
      `Lista ma więcej niż ${MAX_RECIPIENTS} adresów. Podziel ją — jedna wysyłka obsługuje ${MAX_RECIPIENTS}.`,
    );
  }

  // Before consent, before anything: people who already told us to stop. This is
  // the one rule no operator declaration can override, so it is not a check the
  // form can tick past — the addresses simply leave the list.
  const suppressed = await findSuppressed(parsedRecipients.map((r) => r.email));
  const allowed = parsedRecipients.filter((r) => !suppressed.has(r.email));
  const suppressedCount = parsedRecipients.length - allowed.length;

  if (allowed.length === 0) {
    throw invalidState(
      suppressedCount > 0
        ? `Wszystkie ${suppressedCount} adresów z tej listy wypisało się z wiadomości. Nie ma do kogo wysłać.`
        : "Lista adresatów jest pusta. Wklej listę i sprawdź ją przed wysyłką.",
    );
  }

  const annotated = await annotateConsent(allowed);
  const withoutConsent = annotated.filter((r) => r.consent !== "GRANTED");

  if (withoutConsent.length > 0 && !parsed.consentOverride) {
    throw invalidState(
      `${withoutConsent.length} z ${annotated.length} adresów nie ma u nas zgody marketingowej. Zaznacz oświadczenie o podstawie prawnej albo usuń te adresy z listy.`,
    );
  }

  // One secret per recipient, minted here and never stored: the row keeps only
  // its HMAC, the mail carries the token.
  const tokens = new Map(annotated.map((r) => [r.email, newUnsubscribeToken()]));

  const campaignId = await db.transaction(async (tx) => {
    const [campaign] = await tx
      .insert(emailCampaigns)
      .values({
        subject: draft.subject,
        preheader: draft.preheader ?? null,
        heading: draft.heading,
        paragraphs: draft.paragraphs,
        ctaLabel: draft.ctaLabel ?? null,
        ctaUrl: draft.ctaUrl ?? null,
        createdBy: adminUserId,
        consentOverride: withoutConsent.length > 0,
        recipientCount: annotated.length,
        startedAt: new Date(),
      })
      .returning({ id: emailCampaigns.id });

    if (!campaign) throw new Error("Failed to insert campaign.");

    // Written before anything leaves the process, so an interrupted send leaves
    // evidence rather than a mystery.
    await tx.insert(emailCampaignRecipients).values(
      annotated.map((recipient) => ({
        campaignId: campaign.id,
        email: recipient.email,
        name: recipient.name,
        consent: recipient.consent,
        unsubscribeTokenHash: hashUnsubscribeToken(tokens.get(recipient.email)!),
      })),
    );

    return campaign.id;
  });

  const provider = getEmailProvider();
  const errors = new Set<string>();
  let sentCount = 0;
  let failedCount = 0;

  const queue = [...annotated];

  async function worker(): Promise<void> {
    for (;;) {
      const recipient = queue.shift();
      if (!recipient) return;

      const result = await provider
        .send({
          to: recipient.email,
          template: "owner-campaign",
          data: templateData(draft, {
            name: recipient.name,
            unsubscribeUrl: unsubscribeUrl(tokens.get(recipient.email)!),
          }),
          // One address, one campaign, one mail — even if this runs twice.
          idempotencyKey: `campaign:${campaignId}:${recipient.email}`,
        })
        .catch((error: unknown) => ({
          ok: false as const,
          reason: error instanceof Error ? error.message : "unknown error",
        }));

      if (result.ok) {
        sentCount += 1;
        await db
          .update(emailCampaignRecipients)
          .set({
            status: "SENT",
            sentAt: new Date(),
            providerRef: result.providerRef ?? null,
            updatedAt: sql`now()`,
          })
          .where(
            and(
              eq(emailCampaignRecipients.campaignId, campaignId),
              eq(emailCampaignRecipients.email, recipient.email),
            ),
          );
      } else {
        failedCount += 1;
        errors.add(result.reason);
        await db
          .update(emailCampaignRecipients)
          .set({ status: "FAILED", error: result.reason.slice(0, 500), updatedAt: sql`now()` })
          .where(
            and(
              eq(emailCampaignRecipients.campaignId, campaignId),
              eq(emailCampaignRecipients.email, recipient.email),
            ),
          );
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, annotated.length) }, () => worker()),
  );

  await db
    .update(emailCampaigns)
    .set({ sentCount, failedCount, finishedAt: new Date(), updatedAt: sql`now()` })
    .where(eq(emailCampaigns.id, campaignId));

  return {
    campaignId,
    recipientCount: annotated.length,
    sentCount,
    failedCount,
    suppressedCount,
    errors: [...errors].slice(0, 5),
  };
}

/* -------------------------------------------------------------------------- */
/* History                                                                    */
/* -------------------------------------------------------------------------- */

export type CampaignSummary = {
  id: string;
  createdAt: Date;
  subject: string;
  heading: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  consentOverride: boolean;
  finishedAt: Date | null;
  authorEmail: string | null;
};

export async function listCampaigns(limit = 20): Promise<CampaignSummary[]> {
  return db
    .select({
      id: emailCampaigns.id,
      createdAt: emailCampaigns.createdAt,
      subject: emailCampaigns.subject,
      heading: emailCampaigns.heading,
      recipientCount: emailCampaigns.recipientCount,
      sentCount: emailCampaigns.sentCount,
      failedCount: emailCampaigns.failedCount,
      consentOverride: emailCampaigns.consentOverride,
      finishedAt: emailCampaigns.finishedAt,
      authorEmail: users.email,
    })
    .from(emailCampaigns)
    .leftJoin(users, eq(users.id, emailCampaigns.createdBy))
    .orderBy(desc(emailCampaigns.createdAt))
    .limit(limit);
}

/** Who a campaign actually reached, for the day somebody asks. */
export async function getCampaignRecipients(input: unknown) {
  const { campaignId } = campaignIdSchema.parse(input);

  const [campaign] = await db
    .select({ id: emailCampaigns.id })
    .from(emailCampaigns)
    .where(eq(emailCampaigns.id, campaignId))
    .limit(1);

  if (!campaign) throw notFound("Kampania");

  return db
    .select({
      email: emailCampaignRecipients.email,
      name: emailCampaignRecipients.name,
      consent: emailCampaignRecipients.consent,
      status: emailCampaignRecipients.status,
      error: emailCampaignRecipients.error,
      sentAt: emailCampaignRecipients.sentAt,
    })
    .from(emailCampaignRecipients)
    .where(eq(emailCampaignRecipients.campaignId, campaignId))
    .orderBy(emailCampaignRecipients.email);
}
