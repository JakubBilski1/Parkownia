import { createHash } from "node:crypto";
import Stripe from "stripe";
import {
  WebhookSignatureError,
  type AccountLinkInput,
  type ConnectAccountInput,
  type ConnectAccountState,
  type ConnectOnboarding,
  type CreateIntentInput,
  type CreateIntentResult,
  type IntentSnapshot,
  type IntentStatus,
  type NormalizedEvent,
  type PaymentProvider,
  type RefundInput,
  type RefundResult,
} from "./provider";

/**
 * Stripe Connect Express, destination charges + application_fee_amount
 * (docs/PAYMENTS.md §1). The platform is merchant of record — our descriptor on
 * the driver's statement — the commission is taken automatically, and the rest
 * lands on the host's connected account.
 *
 * PLN's smallest unit is the grosz, which is exactly how money is stored here,
 * so `amount` needs no conversion. If that ever stops being true, it stops being
 * true loudly (a factor-of-100 bug), not quietly.
 */
export class StripePaymentProvider implements PaymentProvider, ConnectOnboarding {
  readonly dbName = "STRIPE" as const;
  readonly slug = "stripe";

  private readonly client: Stripe;
  private readonly webhookSecret: string;

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set but PAYMENT_PROVIDER=stripe");
    }
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
    this.client = new Stripe(key);
  }

  async createIntent(input: CreateIntentInput): Promise<CreateIntentResult> {
    if (!input.destinationAccountId) {
      // Selling a spot we cannot pay the host for is a debt, not a sale
      // (docs/PAYMENTS.md §2.2).
      throw new Error("Host has no connected Stripe account — the parking must not be bookable");
    }

    const intent = await this.client.paymentIntents.create({
      amount: input.amountGr,
      currency: "pln",
      payment_method_types: [input.method === "BLIK" ? "blik" : "card"],
      transfer_data: { destination: input.destinationAccountId },
      application_fee_amount: input.applicationFeeGr,
      metadata: { bookingId: input.bookingId },
      ...(input.customerEmail ? { receipt_email: input.customerEmail } : {}),
    });

    return {
      providerRef: intent.id,
      clientSecret: intent.client_secret,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? null,
    };
  }

  async retrieveIntent(providerRef: string): Promise<IntentSnapshot> {
    const intent = await this.client.paymentIntents.retrieve(providerRef);
    return {
      status: mapIntentStatus(intent.status),
      amountGr: intent.amount_received > 0 ? intent.amount_received : intent.amount,
      bookingId: intent.metadata?.bookingId ?? null,
      failureReason: intent.last_payment_error?.code ?? null,
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const refund = await this.client.refunds.create({
      payment_intent: input.providerRef,
      amount: input.amountGr,
      reverse_transfer: input.reverseTransfer ?? true,
      refund_application_fee: input.refundApplicationFee ?? true,
    });

    return { refundedGr: refund.amount, providerRefundRef: refund.id };
  }

  /* ------------------------------------------------------------------------ */
  /* Connect onboarding (docs/PAYMENTS.md §2.2)                               */
  /* ------------------------------------------------------------------------ */

  /**
   * Express: Stripe hosts the KYC form and owns the identity checks, which is the
   * entire reason this option was chosen — a private individual with no company
   * can be onboarded without us ever touching an ID document.
   *
   * `card_payments` and `transfers` are requested, not assumed: Stripe decides
   * when they turn on, and it tells us so through account.updated. BLIK is a
   * platform-level capability on the destination charge, so the connected account
   * does not request it here.
   */
  async createConnectedAccount(input: ConnectAccountInput): Promise<string> {
    const account = await this.client.accounts.create({
      type: "express",
      country: "PL",
      email: input.email,
      business_type: input.businessType,
      default_currency: "pln",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      ...(input.businessType === "company"
        ? {
            company: {
              ...(input.companyName ? { name: input.companyName } : {}),
              ...(input.nip ? { tax_id: input.nip } : {}),
            },
          }
        : {}),
      settings: {
        payouts: {
          // Weekly, to amortise the 0,25% + 1,35 zł per-payout fee across a whole
          // week of bookings instead of paying it on every 30 zł ticket.
          schedule: { interval: "weekly", weekly_anchor: "monday" },
        },
      },
    });

    return account.id;
  }

  /**
   * The link is single-use and expires in minutes. That is why it is minted on
   * every click and never persisted: a stored onboarding URL is a dead link the
   * host clicks on Saturday morning when nobody is around to help them.
   */
  async createAccountLink(input: AccountLinkInput): Promise<string> {
    const link = await this.client.accountLinks.create({
      account: input.accountId,
      refresh_url: input.refreshUrl,
      return_url: input.returnUrl,
      type: "account_onboarding",
      collection_options: { fields: "currently_due" },
    });

    return link.url;
  }

  async retrieveAccountState(accountId: string): Promise<ConnectAccountState> {
    const account = await this.client.accounts.retrieve(accountId);
    return readAccountState(account);
  }

  async verifyWebhook(rawBody: string, headers: Headers): Promise<unknown> {
    const signature = headers.get("stripe-signature");
    if (!signature || !this.webhookSecret) {
      throw new WebhookSignatureError();
    }

    try {
      return await this.client.webhooks.constructEventAsync(rawBody, signature, this.webhookSecret);
    } catch {
      // Deliberately no detail and no body in the error: an unverified payload
      // is attacker-controlled and never reaches the log.
      throw new WebhookSignatureError();
    }
  }

  parseEvent(verified: unknown, rawBody: string): NormalizedEvent {
    const event = verified as Stripe.Event;
    const payloadHash = createHash("sha256").update(rawBody).digest("hex");
    const base = {
      id: event.id,
      bookingId: null as string | null,
      providerRef: null as string | null,
      amountGr: null as number | null,
      refundedGr: null as number | null,
      failureReason: null as string | null,
      account: null as ConnectAccountState | null,
      payloadHash,
    };

    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        return {
          ...base,
          type: "PAYMENT_SUCCEEDED",
          bookingId: intent.metadata?.bookingId ?? null,
          providerRef: intent.id,
          amountGr: intent.amount_received > 0 ? intent.amount_received : intent.amount,
        };
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        return {
          ...base,
          type: "PAYMENT_FAILED",
          bookingId: intent.metadata?.bookingId ?? null,
          providerRef: intent.id,
          amountGr: intent.amount,
          failureReason: intent.last_payment_error?.code ?? "payment_failed",
        };
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        return {
          ...base,
          type: "PAYMENT_REFUNDED",
          bookingId: charge.metadata?.bookingId ?? null,
          providerRef: refFromCharge(charge.payment_intent),
          amountGr: charge.amount,
          refundedGr: charge.amount_refunded,
        };
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        return {
          ...base,
          type: "DISPUTE_CREATED",
          providerRef: refFromCharge(dispute.payment_intent),
          amountGr: dispute.amount,
        };
      }

      case "account.updated":
        return {
          ...base,
          type: "ACCOUNT_UPDATED",
          account: handleAccountUpdated(event),
        };

      default:
        // An unknown event is not an error. 200 and move on.
        return { ...base, type: "IGNORED" };
    }
  }
}

/**
 * The host finished (or failed, or half-finished) their KYC. Stripe is the only
 * source of these two booleans — we never infer "they must be verified by now"
 * from the fact that they clicked through the form, because Stripe routinely
 * comes back days later asking for a document and flips payouts_enabled off.
 *
 * Pure translation: it reads the event and returns the verdict. Writing it to a
 * user is the domain's job (payments/onboarding.ts), so this file stays free of
 * database access and can be reasoned about as pure protocol.
 */
export function handleAccountUpdated(event: Stripe.Event): ConnectAccountState | null {
  if (event.type !== "account.updated") return null;
  return readAccountState(event.data.object);
}

function readAccountState(account: Stripe.Account): ConnectAccountState {
  return {
    accountId: account.id,
    chargesEnabled: account.charges_enabled === true,
    payoutsEnabled: account.payouts_enabled === true,
  };
}

function refFromCharge(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function mapIntentStatus(status: Stripe.PaymentIntent.Status): IntentStatus {
  switch (status) {
    case "succeeded":
      return "SUCCEEDED";
    case "canceled":
      return "CANCELED";
    case "requires_payment_method":
    case "requires_confirmation":
    case "requires_action":
    case "processing":
    case "requires_capture":
      return "PENDING";
    default:
      return "PENDING";
  }
}
