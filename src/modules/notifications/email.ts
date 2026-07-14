import nodemailer, { type Transporter } from "nodemailer";
import {
  attempt,
  maskRecipient,
  type EmailMessage,
  type EmailProvider,
  type SendResult,
} from "./provider";

const DEFAULT_FROM = "ParkSpot <no-reply@parkspot.pl>";

function from(): string {
  return process.env.EMAIL_FROM || DEFAULT_FROM;
}

/* -------------------------------------------------------------------------- */
/* console — the development default                                          */
/* -------------------------------------------------------------------------- */

class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";

  async send(message: EmailMessage): Promise<SendResult> {
    const lines = [
      `[email:console] to=${maskRecipient(message.to)} subject=${message.subject}`,
    ];
    // Bodies carry the parking address, the booking code and the recipient's name.
    // They are a development affordance and must never reach a production log.
    if (process.env.NODE_ENV !== "production") {
      lines.push(message.text);
      if (message.attachments?.length) {
        lines.push(
          `[email:console] attachments: ${message.attachments.map((a) => a.filename).join(", ")}`,
        );
      }
    }
    console.info(lines.join("\n"));
    return { ok: true };
  }
}

/* -------------------------------------------------------------------------- */
/* smtp — nodemailer                                                          */
/* -------------------------------------------------------------------------- */

class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";
  private transporter: Transporter | undefined;

  constructor(private readonly url: string) {}

  private transport(): Transporter {
    this.transporter ??= nodemailer.createTransport(this.url);
    return this.transporter;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    return attempt(async () => {
      const info = await this.transport().sendMail({
        from: from(),
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        attachments: message.attachments?.map((attachment) => ({
          filename: attachment.filename,
          contentType: attachment.contentType,
          content: Buffer.from(attachment.content, "base64"),
          cid: attachment.contentId,
        })),
      });
      return { ok: true, providerRef: info.messageId };
    });
  }
}

/* -------------------------------------------------------------------------- */
/* resend — HTTP API, no SDK dependency                                       */
/* -------------------------------------------------------------------------- */

type ResendResponse = { id?: string; message?: string; name?: string };

class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";

  constructor(private readonly apiKey: string) {}

  async send(message: EmailMessage): Promise<SendResult> {
    return attempt(async () => {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: from(),
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          attachments: message.attachments?.map((attachment) => ({
            filename: attachment.filename,
            content: attachment.content,
            content_type: attachment.contentType,
            content_id: attachment.contentId,
          })),
        }),
      });

      const body = (await response.json().catch(() => ({}))) as ResendResponse;
      if (!response.ok) {
        return { ok: false, reason: `resend ${response.status}: ${body.message ?? body.name ?? ""}` };
      }
      return { ok: true, providerRef: body.id };
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
    case "smtp": {
      const url = process.env.SMTP_URL;
      if (!url) throw new Error('EMAIL_PROVIDER="smtp" requires SMTP_URL.');
      return new SmtpEmailProvider(url);
    }
    case "resend": {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) throw new Error('EMAIL_PROVIDER="resend" requires RESEND_API_KEY.');
      return new ResendEmailProvider(apiKey);
    }
    case "console":
      return new ConsoleEmailProvider();
    default:
      throw new Error(
        `Unknown EMAIL_PROVIDER "${configured}" — expected "console", "smtp" or "resend".`,
      );
  }
}
