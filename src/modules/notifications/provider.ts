export type EmailAttachment = {
  filename: string;
  contentType: string;
  /** Base64, without a data-URI prefix. */
  content: string;
  /** Set to reference the attachment inline as <img src="cid:…">. */
  contentId?: string;
};

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  /** Every email ships a plain-text body: inboxes that strip CSS still read. */
  text: string;
  attachments?: EmailAttachment[];
};

export type SmsMessage = {
  /** E.164 (+48…). */
  to: string;
  body: string;
};

export type SendResult =
  | { ok: true; providerRef?: string }
  | { ok: false; reason: string };

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<SendResult>;
}

export interface SmsProvider {
  readonly name: string;
  /** Returns { ok: false, reason: "disabled" } when SMS_ENABLED is not true. */
  send(message: SmsMessage): Promise<SendResult>;
}

/**
 * Provider errors are values, not exceptions: a dead SMTP host must not roll back
 * a confirmed booking. Everything below funnels network failures into SendResult.
 */
export async function attempt(fn: () => Promise<SendResult>): Promise<SendResult> {
  try {
    return await fn();
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "unknown error" };
  }
}

/** Logs and dev output never carry a full address (docs/ARCHITECTURE.md §6, RODO). */
export function maskRecipient(value: string): string {
  const at = value.indexOf("@");
  if (at > 0) {
    const local = value.slice(0, at);
    const head = local.slice(0, Math.min(2, local.length));
    return `${head}${"*".repeat(Math.max(1, local.length - head.length))}@${value.slice(at + 1)}`;
  }
  return `${value.slice(0, 3)}${"*".repeat(Math.max(1, value.length - 6))}${value.slice(-2)}`;
}
