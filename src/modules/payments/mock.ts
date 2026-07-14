import { createHash, randomUUID } from "node:crypto";
import {
  WebhookSignatureError,
  type CreateIntentInput,
  type CreateIntentResult,
  type IntentSnapshot,
  type IntentStatus,
  type NormalizedEvent,
  type PaymentProvider,
  type RefundInput,
  type RefundResult,
} from "./provider";

type MockIntent = {
  bookingId: string;
  amountGr: number;
  status: IntentStatus;
  refundedGr: number;
};

// Process-local. A dev-server restart forgets in-flight intents, which is
// exactly what a mock should cost you — nothing.
const intents = new Map<string, MockIntent>();

type MockWebhookBody = {
  id?: string;
  type?: string;
  bookingId?: string;
  providerRef?: string;
  failureReason?: string;
};

/**
 * The default provider in development (PAYMENT_PROVIDER=mock). It exists so the
 * whole flow — hold, intent, webhook, signature check, idempotency, amount
 * comparison, confirmation, QR — runs end to end on a laptop with no Stripe keys
 * and no tunnel. It is not a stub that returns `true`: the dev UI posts a real
 * webhook to /api/webhooks/mock and it travels the same code path Stripe does.
 *
 * The amount is taken from the intent this process created, never from the
 * webhook body, so "simulate success" cannot mint a booking at the wrong price.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly dbName = "MANUAL" as const;
  readonly slug = "mock";

  async createIntent(input: CreateIntentInput): Promise<CreateIntentResult> {
    const providerRef = `mock_pi_${randomUUID()}`;
    intents.set(providerRef, {
      bookingId: input.bookingId,
      amountGr: input.amountGr,
      status: "PENDING",
      refundedGr: 0,
    });

    return {
      providerRef,
      clientSecret: `${providerRef}_secret`,
      publishableKey: null,
      simulated: true,
    };
  }

  async retrieveIntent(providerRef: string): Promise<IntentSnapshot> {
    const intent = intents.get(providerRef);
    if (!intent) {
      return { status: "PENDING", amountGr: null, bookingId: null, failureReason: null };
    }
    return {
      status: intent.status,
      amountGr: intent.amountGr,
      bookingId: intent.bookingId,
      failureReason: null,
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const intent = intents.get(input.providerRef);
    if (intent) {
      intent.refundedGr = Math.min(intent.amountGr, intent.refundedGr + input.amountGr);
    }
    return { refundedGr: input.amountGr, providerRefundRef: `mock_re_${randomUUID()}` };
  }

  async verifyWebhook(rawBody: string): Promise<unknown> {
    // The mock's "signature" is the environment itself: it refuses to exist in
    // production. Wiring it live would mean anyone could POST themselves a paid
    // booking, so this guard is the security control, not a convenience.
    if (process.env.NODE_ENV === "production") {
      throw new WebhookSignatureError("Mock payments are disabled in production");
    }
    if ((process.env.PAYMENT_PROVIDER ?? "mock") !== "mock") {
      throw new WebhookSignatureError("Mock webhooks are disabled when a real PSP is configured");
    }

    try {
      return JSON.parse(rawBody) as MockWebhookBody;
    } catch {
      throw new WebhookSignatureError("Malformed mock webhook body");
    }
  }

  parseEvent(verified: unknown, rawBody: string): NormalizedEvent {
    const body = (verified ?? {}) as MockWebhookBody;
    const payloadHash = createHash("sha256").update(rawBody).digest("hex");
    const providerRef = body.providerRef ?? null;
    const intent = providerRef ? intents.get(providerRef) : undefined;

    const base = {
      id: body.id ?? randomUUID(),
      bookingId: intent?.bookingId ?? body.bookingId ?? null,
      providerRef,
      refundedGr: null,
      failureReason: null,
      // The mock does not onboard anyone: in dev there is no KYC to pass, which
      // is exactly why the publication rule below is Stripe-only.
      account: null,
      payloadHash,
    };

    switch (body.type) {
      case "PAYMENT_SUCCEEDED":
        if (intent) intent.status = "SUCCEEDED";
        return { ...base, type: "PAYMENT_SUCCEEDED", amountGr: intent?.amountGr ?? null };

      case "PAYMENT_FAILED":
        if (intent) intent.status = "FAILED";
        return {
          ...base,
          type: "PAYMENT_FAILED",
          amountGr: intent?.amountGr ?? null,
          failureReason: body.failureReason ?? "mock_declined",
        };

      case "PAYMENT_REFUNDED":
        return {
          ...base,
          type: "PAYMENT_REFUNDED",
          amountGr: intent?.amountGr ?? null,
          refundedGr: intent?.refundedGr ?? null,
        };

      default:
        return { ...base, type: "IGNORED", amountGr: null };
    }
  }
}
