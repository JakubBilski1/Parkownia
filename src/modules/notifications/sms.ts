import { attempt, type SendResult, type SmsMessage, type SmsProvider } from "./provider";

const SMSAPI_URL = "https://api.smsapi.pl/sms.do";

/**
 * One SMS costs 0.08–0.12 zł against a ~6 zł commission (docs/RISKS.md R16), so the
 * channel is off unless someone turns it on deliberately, and only two templates
 * may ever use it (see templates.ts).
 */
export function isSmsEnabled(): boolean {
  return process.env.SMS_ENABLED === "true";
}

/**
 * "+48123456789" | "123 456 789" | "0048123456789" -> "+48123456789".
 * Returns undefined for anything that is not a plausible mobile number: an SMS to
 * a malformed number is money burned for nothing.
 */
export function normalizePhone(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/[^\d+]/g, "");

  let national: string;
  if (digits.startsWith("+48")) national = digits.slice(3);
  else if (digits.startsWith("0048")) national = digits.slice(4);
  else if (digits.startsWith("48") && digits.length === 11) national = digits.slice(2);
  else if (digits.startsWith("+")) return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : undefined;
  else national = digits.replace(/^0/, "");

  return /^\d{9}$/.test(national) ? `+48${national}` : undefined;
}

const GSM7_MAX = 160;

/**
 * Polish diacritics force the message out of the GSM-7 alphabet into UCS-2, which
 * cuts a segment from 160 characters to 70 — the same text suddenly costs three
 * segments instead of one. Codes and addresses survive transliteration; the price
 * of a second segment does not survive the commission. Copy stays Polish, ASCII.
 */
export function prepareSmsBody(body: string): string {
  const ascii = body
    .normalize("NFD")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return ascii.length <= GSM7_MAX ? ascii : `${ascii.slice(0, GSM7_MAX - 3).trimEnd()}...`;
}

class DisabledSmsProvider implements SmsProvider {
  readonly name = "disabled";

  async send(): Promise<SendResult> {
    return { ok: false, reason: "disabled" };
  }
}

type SmsapiResponse = { count?: number; list?: { id?: string }[]; message?: string };

class SmsapiProvider implements SmsProvider {
  readonly name = "smsapi";

  constructor(
    private readonly token: string,
    private readonly sender: string,
  ) {}

  async send(message: SmsMessage): Promise<SendResult> {
    return attempt(async () => {
      const params = new URLSearchParams({
        to: message.to,
        message: message.body,
        from: this.sender,
        format: "json",
        encoding: "utf-8",
      });

      const response = await fetch(SMSAPI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });

      const body = (await response.json().catch(() => ({}))) as SmsapiResponse;
      // SMSAPI answers 200 with an { message } error envelope, so status alone lies.
      if (!response.ok || !body.count) {
        return { ok: false, reason: `smsapi ${response.status}: ${body.message ?? "no message id"}` };
      }
      return { ok: true, providerRef: body.list?.[0]?.id };
    });
  }
}

let cached: SmsProvider | undefined;

export function getSmsProvider(): SmsProvider {
  cached ??= createSmsProvider();
  return cached;
}

/** Test seam — pass undefined to fall back to the environment on the next call. */
export function setSmsProvider(provider: SmsProvider | undefined): void {
  cached = provider;
}

function createSmsProvider(): SmsProvider {
  if (!isSmsEnabled()) return new DisabledSmsProvider();

  const token = process.env.SMSAPI_TOKEN;
  if (!token) throw new Error('SMS_ENABLED="true" requires SMSAPI_TOKEN.');

  return new SmsapiProvider(token, process.env.SMSAPI_SENDER || "Info");
}
