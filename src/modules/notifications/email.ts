import { attempt, maskRecipient, type EmailMessage, type EmailProvider, type SendResult } from "./provider";

/* -------------------------------------------------------------------------- */
/* console — the development default                                          */
/* -------------------------------------------------------------------------- */

class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";

  async send(message: EmailMessage): Promise<SendResult> {
    const lines = [`[email:console] to=${maskRecipient(message.to)} template=${message.template}`];
    // The data carries the parking address, the booking code and the recipient's
    // name. A development affordance that must never reach a production log.
    if (process.env.NODE_ENV !== "production") {
      lines.push(`[email:console] data=${JSON.stringify(message.data)}`);
    }
    console.info(lines.join("\n"));
    return { ok: true };
  }
}

/* -------------------------------------------------------------------------- */
/* pbdevs — HTTP mail API, templates rendered server-side                     */
/* -------------------------------------------------------------------------- */

const DEFAULT_API_URL = "https://mail.pbdevs.com/api/v1/send";

type PbdevsResponse = { message_id?: string; status?: string; error?: string };

/**
 * The app does not render mail any more: pbdevs holds the MJML + Handlebars
 * templates and renders them from { template, to, data }. There is no raw HTML
 * and no attachments over this API, so anything that used to be an attachment
 * (the booking QR) is passed as a URL in `data` and referenced with <img> in the
 * template — see templates.ts and modules/notifications/qr.ts.
 */
class PbdevsEmailProvider implements EmailProvider {
  readonly name = "pbdevs";

  constructor(
    private readonly apiKey: string,
    private readonly url: string,
  ) {}

  async send(message: EmailMessage): Promise<SendResult> {
    return attempt(async () => {
      const response = await fetch(this.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          template: message.template,
          to: message.to,
          data: message.data,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as PbdevsResponse;
      if (!response.ok) {
        // The renderer knows the template names; a 404 here is almost always a
        // template that exists in the app but not yet in the pbdevs dashboard.
        return { ok: false, reason: `pbdevs ${response.status}: ${body.error ?? "send failed"}` };
      }
      // 202 { message_id, status: "queued" | "duplicate" } — both are success.
      return { ok: true, providerRef: body.message_id };
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Factory                                                                    */
/* -------------------------------------------------------------------------- */

let cached: EmailProvider | undefined;

export function getEmailProvider(): EmailProvider {
  cached ??= createEmailProvider();
  return cached;
}

/** Test seam — pass undefined to fall back to the environment on the next call. */
export function setEmailProvider(provider: EmailProvider | undefined): void {
  cached = provider;
}

function createEmailProvider(): EmailProvider {
  const configured = process.env.EMAIL_PROVIDER ?? "console";

  switch (configured) {
    case "pbdevs": {
      const apiKey = process.env.MAIL_API_KEY;
      if (!apiKey) throw new Error('EMAIL_PROVIDER="pbdevs" requires MAIL_API_KEY.');
      return new PbdevsEmailProvider(apiKey, process.env.MAIL_API_URL || DEFAULT_API_URL);
    }
    case "console":
      return new ConsoleEmailProvider();
    default:
      throw new Error(`Unknown EMAIL_PROVIDER "${configured}" — expected "console" or "pbdevs".`);
  }
}
