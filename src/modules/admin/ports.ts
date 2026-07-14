import { AdminError } from "./errors";

/**
 * Seams to modules other agents own. Both are registered at boot (integration
 * step); until then the admin panel degrades honestly rather than pretending:
 * moderation still works but says the e-mail did not go out, and a refund on a
 * PSP-backed payment refuses to touch the database at all.
 */

/* -------------------------------------------------------------------------- */
/* notifications (src/modules/notifications)                                  */
/* -------------------------------------------------------------------------- */

export type ParkingDecisionMail = {
  hostId: string;
  parkingId: string;
  parkingTitle: string;
  decision: "ACTIVE" | "REJECTED";
  /** Present exactly when decision is REJECTED. */
  reason?: string;
};

export type AdminNotifier = {
  parkingReviewed: (mail: ParkingDecisionMail) => Promise<void>;
};

let notifier: AdminNotifier | null = null;

export function registerAdminNotifier(implementation: AdminNotifier): void {
  notifier = implementation;
}

/**
 * Never throws: a mail outage must not block moderation. The caller reports
 * `mailSent: false` upwards so the operator knows the host was not told.
 */
export async function notifyParkingReviewed(mail: ParkingDecisionMail): Promise<boolean> {
  if (!notifier) return false;
  try {
    await notifier.parkingReviewed(mail);
    return true;
  } catch {
    // No payload, no PII in the log — just the fact and the id.
    console.error("[admin] parking decision mail failed", mail.parkingId);
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* payments (src/modules/payments)                                            */
/* -------------------------------------------------------------------------- */

export type RefundRequest = {
  paymentId: string;
  provider: "MANUAL" | "STRIPE" | "P24" | "AUTOPAY";
  providerRef: string | null;
  amountGr: number;
  /** Reverses the host's share of the transfer proportionally (PAYMENTS.md §2.3). */
  hostShareGr: number;
};

export type RefundResult = {
  /** The PSP's id for this refund — stored so a webhook can be matched to it. */
  providerRefundRef: string | null;
};

export type PaymentRefunder = {
  refund: (request: RefundRequest) => Promise<RefundResult>;
};

let refunder: PaymentRefunder | null = null;

export function registerPaymentRefunder(implementation: PaymentRefunder): void {
  refunder = implementation;
}

/**
 * MANUAL payments were never taken through a PSP, so "refunding" one is a
 * bookkeeping entry plus a bank transfer the operator makes by hand. Every other
 * provider needs the payments module — without it we refuse, because writing
 * "REFUNDED" into the database while the money sits at Stripe is a lie that
 * costs a chargeback.
 */
export async function refundThroughProvider(request: RefundRequest): Promise<RefundResult> {
  if (refunder) return refunder.refund(request);

  if (request.provider === "MANUAL") return { providerRefundRef: null };

  throw new AdminError(
    "REFUND_PROVIDER_UNAVAILABLE",
    503,
    "Zwrot nie został wykonany. Pieniądze nadal są u operatora płatności, kierowca ich nie dostał. Moduł płatności nie jest podpięty — zgłoś to zespołowi.",
  );
}
