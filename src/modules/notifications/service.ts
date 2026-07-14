import { render } from "@react-email/components";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { notificationLog } from "@/db/schema";
import { getEmailProvider } from "./email";
import { maskRecipient, type SendResult } from "./provider";
import { getSmsProvider, isSmsEnabled, normalizePhone, prepareSmsBody } from "./sms";
import { templates, type NotificationPayloads, type TemplateId } from "./templates";

/**
 * Every send is validated on the way in — a booking confirmation posted to a
 * malformed address is a driver standing at a barrier without a code.
 */
const recipientSchema = z.object({
  userId: z.uuid(),
  email: z.email(),
  phone: z.string().min(1).nullish(),
});

export type Recipient = z.infer<typeof recipientSchema>;

export type ChannelOutcome = "sent" | "skipped" | "failed";

export type NotificationResult = {
  email: ChannelOutcome;
  sms: ChannelOutcome;
  /** Why a channel did not send. Never contains the message body or an address. */
  reasons: Partial<Record<"email" | "sms", string>>;
};

export type SendNotificationInput<K extends TemplateId> = {
  template: K;
  recipient: Recipient;
  /**
   * The domain object this notification is about: bookingId, eventId, parkingId,
   * payoutId, or the action-token id for account mails. Together with the template
   * it is the deduplication key (see notification_log in src/db/schema.ts).
   */
  relatedId: string;
  payload: NotificationPayloads[K];
};

export async function sendNotification<K extends TemplateId>(
  input: SendNotificationInput<K>,
): Promise<NotificationResult> {
  const recipient = recipientSchema.parse(input.recipient);
  const relatedId = z.uuid().parse(input.relatedId);
  const template = templates[input.template];

  const result: NotificationResult = { email: "skipped", sms: "skipped", reasons: {} };

  /* -------------------------------- e-mail -------------------------------- */

  const emailClaim = await claim(input.template, "EMAIL", recipient.userId, relatedId, template.dedupe);

  if (!emailClaim) {
    result.reasons.email = "already sent";
  } else {
    const element = template.email(input.payload);
    const [html, text] = await Promise.all([
      render(element),
      render(element, { plainText: true }),
    ]);

    const sent = await getEmailProvider().send({
      to: recipient.email,
      subject: template.subject(input.payload),
      html,
      text,
      attachments: await template.attachments?.(input.payload),
    });

    result.email = await settle(emailClaim, sent, "email", recipient.email);
    if (!sent.ok) result.reasons.email = sent.reason;
  }

  /* --------------------------------- SMS ---------------------------------- */

  const smsBody = template.sms?.(input.payload);
  const phone = normalizePhone(recipient.phone);

  if (!smsBody || !isSmsEnabled()) {
    return result;
  }
  if (!phone) {
    result.reasons.sms = "no usable phone number";
    return result;
  }

  const smsClaim = await claim(input.template, "SMS", recipient.userId, relatedId, template.dedupe);
  if (!smsClaim) {
    result.reasons.sms = "already sent";
    return result;
  }

  const sent = await getSmsProvider().send({ to: phone, body: prepareSmsBody(smsBody) });
  result.sms = await settle(smsClaim, sent, "sms", phone);
  if (!sent.ok) result.reasons.sms = sent.reason;

  return result;
}

/* -------------------------------------------------------------------------- */
/* notification_log                                                           */
/* -------------------------------------------------------------------------- */

type Channel = "EMAIL" | "SMS";

/**
 * The unique key in the schema is (user_id, template, related_id) — no channel —
 * so the channel is folded into the logged template name ("booking-confirmed:sms").
 * Without it, sending the SMS would collide with the e-mail row for the same booking.
 */
function logKey(template: TemplateId, channel: Channel): string {
  return `${template}:${channel.toLowerCase()}`;
}

/**
 * Claims the right to send, in one statement, before anything leaves the process.
 * The row is written as SENT up front and downgraded to FAILED if the provider
 * refuses; a crash between the two leaves a row that claims more than it delivered,
 * which is the direction we choose on purpose — a duplicate booking confirmation is
 * noise, but a second invitation to the same host for the same event is spam.
 *
 * Returns the log row id, or null when a previous send already succeeded (dedupe).
 */
async function claim(
  template: TemplateId,
  channel: Channel,
  userId: string,
  relatedId: string,
  dedupe: boolean,
): Promise<string | null> {
  const key = logKey(template, channel);

  const rows = await db
    .insert(notificationLog)
    .values({ userId, channel, template: key, relatedId, status: "SENT" })
    .onConflictDoUpdate({
      target: [notificationLog.userId, notificationLog.template, notificationLog.relatedId],
      set: { status: "SENT", sentAt: sql`now()`, updatedAt: sql`now()` },
      // A failed attempt may be retried; a successful one may not be repeated.
      setWhere: dedupe ? eq(notificationLog.status, "FAILED") : undefined,
    })
    .returning({ id: notificationLog.id });

  return rows[0]?.id ?? null;
}

async function settle(
  logId: string,
  sent: SendResult,
  channel: "email" | "sms",
  recipient: string,
): Promise<ChannelOutcome> {
  if (sent.ok) return "sent";

  await db
    .update(notificationLog)
    .set({ status: "FAILED", updatedAt: sql`now()` })
    .where(eq(notificationLog.id, logId));

  console.warn(`[notifications] ${channel} failed for ${maskRecipient(recipient)}: ${sent.reason}`);
  return "failed";
}
