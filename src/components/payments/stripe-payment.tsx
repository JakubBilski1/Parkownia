"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { useStripeAppearance } from "./appearance";

/**
 * Stripe's own SDK, mounted only when PAYMENT_PROVIDER=stripe. The mock path
 * never reaches this file — it posts its own webhook and skips straight to the
 * ticket (see rezerwacja/[id]/checkout-form.tsx).
 *
 * The amount shown on the button comes from the server's intent, not from the
 * page: it is `booking.price_gr`, the same number Stripe was told to charge.
 */

// loadStripe fetches and evaluates Stripe.js. Called once per key, not once per
// render, or every re-render of the checkout would re-download the SDK.
const clients = new Map<string, Promise<Stripe | null>>();

function stripeClient(publishableKey: string): Promise<Stripe | null> {
  const existing = clients.get(publishableKey);
  if (existing) return existing;

  const created = loadStripe(publishableKey, { locale: "pl" });
  clients.set(publishableKey, created);
  return created;
}

export type StripePaymentProps = {
  clientSecret: string;
  publishableKey: string;
  /** Where the driver lands once the money is away: their ticket. */
  bookingId: string;
  /** Server-computed, display only. */
  priceGr: number;
  /** BLIK gives the driver 60 s in their bank app — the copy has to say so. */
  method: "BLIK" | "CARD";
};

export function StripePayment(props: StripePaymentProps) {
  const appearance = useStripeAppearance();

  return (
    <Elements
      stripe={stripeClient(props.publishableKey)}
      options={{ clientSecret: props.clientSecret, appearance, locale: "pl" }}
    >
      <PaymentForm {...props} />
    </Elements>
  );
}

type FormError = {
  /** What happened. */
  title: string;
  /** Whether it cost money, and what to do next (DESIGN_PRINCIPLES §6.10). */
  detail: string;
};

const NOT_CHARGED = "Środki nie zostały pobrane. Miejsce trzymamy dla Ciebie — spróbuj jeszcze raz.";

function PaymentForm({ bookingId, priceGr, method }: StripePaymentProps) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);

  async function pay(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;

    setBusy(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Only used by methods that leave the page (a 3DS redirect that cannot
        // be done in a modal). Everything else resolves here.
        return_url: `${window.location.origin}/rezerwacja/${bookingId}/potwierdzenie`,
      },
      redirect: "if_required",
    });

    if (result.error) {
      // Stripe's messages are already Polish (locale: "pl") and specific — "Kod
      // BLIK wygasł" beats anything generic we could invent. What Stripe does not
      // say, and the driver most needs to hear, is whether the money is gone.
      setError({
        title: result.error.message ?? "Płatność nie przeszła.",
        detail: NOT_CHARGED,
      });
      setBusy(false);
      return;
    }

    // The intent is authorised. It is NOT yet a confirmed booking: the webhook is
    // what turns money into a ticket (docs/PAYMENTS.md §2.1). The confirmation
    // page knows how to wait for it, so the driver is sent there rather than
    // being made to sit on a spinner here.
    router.push(`/rezerwacja/${bookingId}/potwierdzenie`);
  }

  return (
    <form onSubmit={pay} className="flex flex-col gap-5">
      <PaymentElement
        options={{
          layout: "tabs",
          // The e-mail was already collected — asking twice on the payment step
          // is a step backwards for a driver with eight minutes to kickoff.
          fields: { billingDetails: { email: "never" } },
        }}
      />

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-card border border-danger bg-surface p-4"
        >
          <AlertCircle size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-danger" />
          <div className="flex flex-col gap-1">
            <p className="text-body font-semibold text-ink">{error.title}</p>
            <p className="text-ui text-muted">{error.detail}</p>
          </div>
        </div>
      ) : null}

      <div className="sticky bottom-0 -mx-4 border-t border-line bg-bg px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <Button
          type="submit"
          variant="accent"
          size="lg"
          block
          loading={busy}
          disabled={!stripe || !elements}
        >
          {busy ? "Płacimy…" : `Zapłać ${formatMoney(priceGr)}`}
        </Button>
        <p className="pt-2 text-center text-ui text-muted">
          {method === "BLIK"
            ? "Po kliknięciu potwierdź płatność w aplikacji banku. Masz na to 60 sekund."
            : "Bank może poprosić o dodatkowe potwierdzenie."}
        </p>
      </div>
    </form>
  );
}
