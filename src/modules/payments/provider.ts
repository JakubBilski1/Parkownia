import type { PaymentMethod, PaymentProvider as PaymentProviderName } from "@/db/types";

/**
 * The whole PSP surface the rest of the app is allowed to know about.
 * docs/PAYMENTS.md §1: Stripe Connect is the recommendation, not a marriage —
 * PayU/P24 Marketplace get re-quoted after market validation. Everything the
 * app does with money goes through these five methods so that swapping the PSP
 * is a new file in this folder, not a refactor of the booking flow.
 */
export interface PaymentProvider {
  /** How the provider is stored in the DB enum (`payments.provider`). */
  readonly dbName: PaymentProviderName;
  /** URL segment of /api/webhooks/{slug}. */
  readonly slug: string;

  createIntent(input: CreateIntentInput): Promise<CreateIntentResult>;
  retrieveIntent(providerRef: string): Promise<IntentSnapshot>;
  refund(input: RefundInput): Promise<RefundResult>;

  /**
   * Signature verification. ALWAYS the first thing that happens to a webhook
   * body — before parsing, before touching the database. Throws on a bad
   * signature; the caller answers 400 and logs nothing from the body.
   */
  verifyWebhook(rawBody: string, headers: Headers): Promise<unknown>;
  parseEvent(verified: unknown, rawBody: string): NormalizedEvent;
}

export type CreateIntentInput = {
  bookingId: string;
  /** booking.price_gr. There is no code path that takes an amount from a client. */
  amountGr: number;
  /** booking.commission_gr — the platform's cut, frozen at purchase time. */
  applicationFeeGr: number;
  method: PaymentMethod;
  /** Connected account of the host (destination charge). Null = host cannot be paid. */
  destinationAccountId: string | null;
  customerEmail?: string | null;
};

export type CreateIntentResult = {
  providerRef: string;
  /** What the client SDK needs. Null for providers that redirect instead. */
  clientSecret: string | null;
  publishableKey: string | null;
  /** Mock only: the dev UI uses this to drive the simulated webhook. */
  simulated?: boolean;
};

export type IntentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELED";

export type IntentSnapshot = {
  status: IntentStatus;
  amountGr: number | null;
  bookingId: string | null;
  failureReason: string | null;
};

export type RefundInput = {
  providerRef: string;
  amountGr: number;
  /** Pull the host's share back out of their connected account too. */
  reverseTransfer?: boolean;
  /** Give back the platform commission in proportion to the refunded amount. */
  refundApplicationFee?: boolean;
};

export type RefundResult = {
  refundedGr: number;
  providerRefundRef: string | null;
};

export type NormalizedEventType =
  | "PAYMENT_SUCCEEDED"
  | "PAYMENT_FAILED"
  | "PAYMENT_REFUNDED"
  | "DISPUTE_CREATED"
  | "ACCOUNT_UPDATED"
  /** Anything we do not act on. Answer 200 and forget it — never 500 on a stranger. */
  | "IGNORED";

export type NormalizedEvent = {
  /** Provider's event id — the idempotency key in `webhook_events`. */
  id: string;
  type: NormalizedEventType;
  bookingId: string | null;
  providerRef: string | null;
  amountGr: number | null;
  refundedGr: number | null;
  failureReason: string | null;
  /** Set on ACCOUNT_UPDATED only: the host's KYC verdict, as the PSP sees it. */
  account: ConnectAccountState | null;
  /** sha256 of the raw body. The body itself is never stored or logged (PII). */
  payloadHash: string;
};

/* -------------------------------------------------------------------------- */
/* Connect onboarding (docs/PAYMENTS.md §2.2)                                 */
/* -------------------------------------------------------------------------- */

/**
 * What the PSP says about a host's account — never what we hope, never what the
 * host typed into a form. Both flags are written only from a verified webhook or
 * a direct API read, and they mean different things:
 *
 *   chargesEnabled — we may take money for this host's parkings
 *   payoutsEnabled — we can actually get that money to them
 *
 * A parking goes on sale on the second one (docs/PAYMENTS.md §2.2). Charges can
 * be enabled while payouts are still held pending a document, and selling in
 * that window builds a debt to somebody whose bank details Stripe has rejected.
 */
export type ConnectAccountState = {
  accountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
};

export type ConnectAccountInput = {
  email: string;
  /** INDIVIDUAL hosts onboard as `individual`, BUSINESS as `company`. */
  businessType: "individual" | "company";
  /** Only for `company`: prefills the Stripe form, which the host can correct. */
  companyName?: string | null;
  nip?: string | null;
};

export type AccountLinkInput = {
  accountId: string;
  /** Where Stripe sends a host whose link expired — we mint a fresh one. */
  refreshUrl: string;
  /** Where Stripe sends a host who finished (or abandoned) the hosted form. */
  returnUrl: string;
};

/**
 * Onboarding hosts is a Connect concern, not a payments concern: a provider can
 * take money perfectly well without it (the mock does). So it is a separate,
 * optional capability rather than five methods every future PSP must stub out
 * with `throw new Error("not supported")`.
 */
export interface ConnectOnboarding {
  /** Creates the connected account. Returns its id — the caller persists it. */
  createConnectedAccount(input: ConnectAccountInput): Promise<string>;
  /** One-time URL to the PSP's hosted KYC. Short-lived; minted on demand, never stored. */
  createAccountLink(input: AccountLinkInput): Promise<string>;
  /** Reads the account's current verdict straight from the PSP (reconciliation). */
  retrieveAccountState(accountId: string): Promise<ConnectAccountState>;
}

export function supportsConnect(
  provider: PaymentProvider,
): provider is PaymentProvider & ConnectOnboarding {
  return typeof (provider as Partial<ConnectOnboarding>).createConnectedAccount === "function";
}

export class WebhookSignatureError extends Error {
  constructor(message = "Webhook signature verification failed") {
    super(message);
    this.name = "WebhookSignatureError";
  }
}
