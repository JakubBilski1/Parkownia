"use client";

import { AlertCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";

/**
 * Stripe.js is ~200 kB and the default provider is the mock, so it is loaded on
 * demand — a dev running PAYMENT_PROVIDER=mock never downloads it, and neither
 * does a driver until the moment there is an intent to confirm.
 */
const StripePayment = dynamic(
  () => import("@/components/payments/stripe-payment").then((module) => module.StripePayment),
  {
    ssr: false,
    loading: () => <Skeleton className="h-48 w-full rounded-card" />,
  },
);

type Method = "BLIK" | "CARD";

/**
 * The checkout has two phases, and the switch between them is the provider's
 * answer, not an env var read on the client:
 *
 *   mock   → intent.simulated  → the browser posts the webhook, straight to the ticket
 *   stripe → intent.clientSecret → mount the Payment Element and let Stripe take it
 *
 * The booking is already held (15 min) before either phase begins, so moving to
 * the payment step cannot lose the spot.
 */
type Phase =
  | { step: "details" }
  | {
      step: "pay";
      clientSecret: string;
      publishableKey: string;
      bookingId: string;
      method: Method;
    };

type Props = {
  parkingId: string;
  eventId: string | null;
  startsAt: string;
  endsAt: string;
  /** Server-computed. Displayed here, never sent back. */
  priceGr: number;
};

type FormError = {
  /** What happened. */
  title: string;
  /** Whether it cost money, and what to do next (DESIGN_PRINCIPLES §6.10). */
  detail: string;
};

const METHODS = [
  { value: "BLIK" as const, label: "BLIK", hint: "Kod z aplikacji banku. Masz 60 sekund." },
  { value: "CARD" as const, label: "Karta", hint: "Visa, Mastercard." },
];

export function CheckoutForm({ parkingId, eventId, startsAt, endsAt, priceGr }: Props) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("BLIK");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [phase, setPhase] = useState<Phase>({ step: "details" });

  async function submit(formData: FormData) {
    setBusy(true);
    setError(null);

    try {
      const bookingResponse = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          parkingId,
          ...(eventId ? { eventId } : { startsAt, endsAt }),
          spots: 1,
          contact: {
            email: String(formData.get("email") ?? ""),
            phone: String(formData.get("phone") ?? ""),
          },
          consents: {
            terms: formData.get("terms") === "on",
            privacy: formData.get("privacy") === "on",
          },
          // No amount. There is no field for one, on purpose.
        }),
      });

      const booking = await bookingResponse.json();

      if (!bookingResponse.ok) {
        setError({
          title: booking?.error?.message ?? "Nie udało się zarezerwować miejsca.",
          detail: "Nie pobraliśmy żadnych pieniędzy.",
        });
        return;
      }

      const intentResponse = await fetch("/api/payments/intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookingId: booking.bookingId, method }),
      });

      const intent = await intentResponse.json();

      if (!intentResponse.ok) {
        setError({
          title: intent?.error?.message ?? "Nie udało się uruchomić płatności.",
          detail: `Środki nie zostały pobrane. Miejsce trzymamy dla Ciebie 15 minut — spróbuj ponownie.`,
        });
        return;
      }

      if (intent.simulated) {
        // Development provider: the browser plays the part of the bank and posts
        // the webhook. It travels the same signature/idempotency/amount path a
        // real one does — see modules/payments/mock.ts.
        await fetch("/api/webhooks/mock", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: crypto.randomUUID(),
            type: "PAYMENT_SUCCEEDED",
            providerRef: intent.providerRef,
            bookingId: booking.bookingId,
          }),
        });

        router.push(`/rezerwacja/${booking.bookingId}/potwierdzenie`);
        return;
      }

      if (intent.clientSecret && intent.publishableKey) {
        // Stripe. Hand over to the Payment Element: BLIK's 60-second window and
        // the card's 3DS both live inside Stripe's iframe, and neither of them is
        // something we should be reimplementing.
        setPhase({
          step: "pay",
          clientSecret: intent.clientSecret,
          publishableKey: intent.publishableKey,
          bookingId: booking.bookingId,
          method,
        });
        return;
      }

      // An intent with no secret is a misconfigured provider, not a declined
      // card. The driver does not care which — they care that they still have
      // their money and still have their spot.
      setError({
        title: "Płatność nie ruszyła.",
        detail:
          "Środki nie zostały pobrane. Miejsce trzymamy 15 minut — spróbuj ponownie albo wybierz inną metodę.",
      });
    } catch {
      setError({
        title: "Straciliśmy połączenie.",
        detail: "Środki nie zostały pobrane. Sprawdź internet i spróbuj ponownie.",
      });
    } finally {
      setBusy(false);
    }
  }

  if (phase.step === "pay") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-body text-muted">
          Miejsce jest zarezerwowane na 15 minut. Dokończ płatność, a kod dostaniesz od razu.
        </p>
        <StripePayment
          clientSecret={phase.clientSecret}
          publishableKey={phase.publishableKey}
          bookingId={phase.bookingId}
          priceGr={priceGr}
          method={phase.method}
        />
      </div>
    );
  }

  return (
    <form action={submit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <Field
          label="E-mail"
          hint="Tu wyślemy kod i potwierdzenie."
          required
        >
          {(control) => (
            <Input
              {...control}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="jan@example.com"
            />
          )}
        </Field>

        <Field label="Telefon" hint="SMS z kodem, gdyby mail nie dotarł." required>
          {(control) => (
            <Input
              {...control}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="601 234 567"
            />
          )}
        </Field>
      </div>

      <RadioGroup
        name="method"
        legend="Metoda płatności"
        options={METHODS}
        value={method}
        onValueChange={setMethod}
      />

      <div className="flex flex-col gap-2">
        <Checkbox name="terms" required label="Akceptuję regulamin ParkSpot." />
        <Checkbox
          name="privacy"
          required
          label="Zgadzam się na przetwarzanie moich danych do obsługi rezerwacji."
        />
      </div>

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

      {/* Under the thumb, not in a corner (Fitts, DESIGN_PRINCIPLES §6.6). */}
      <div className="sticky bottom-0 -mx-4 border-t border-line bg-bg px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <Button type="submit" variant="accent" size="lg" block loading={busy}>
          {busy ? "Płacimy…" : `Zapłać ${formatMoney(priceGr)}`}
        </Button>
        <p className="pt-2 text-center text-ui text-muted">
          Konto założymy przy okazji — nie musisz się rejestrować.
        </p>
      </div>
    </form>
  );
}
