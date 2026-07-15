export type EmailMessage = {
  to: string;
  /**
   * Name of a template defined in the mail service (pbdevs: MJML + Handlebars,
   * rendered server-side). The app no longer renders HTML — it names a template
   * and hands over the variables. Same string as the notification's TemplateId.
   */
  template: string;
  /** Handlebars variables for the template. Display-ready: dates and money are
   * already formatted here, because the renderer cannot do Polish locale. */
  data: Record<string, unknown>;
  /**
   * Stripe-style idempotency key for the mail API. We already dedupe in
   * notification_log; this is a second line so a retried send cannot double-mail.
   */
  idempotencyKey?: string;
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
