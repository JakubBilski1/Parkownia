"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { Button, Card, CardBody } from "@/components/ui";
import { formatMoney, formatSpots, pluralPl } from "@/lib/format";
import { LinkButton } from "@/modules/events/ui/link-button";

type QuickDeclareFormProps = {
  token: string;
  spots: number;
  priceGr: number;
  parkingTitle: string;
};

type Outcome = "accepted" | "declined";

type ErrorState = { message: string } | null;

/**
 * Critical path 3. One question, two buttons, no login, no extra field — every
 * field added here costs supply (docs/DESIGN_PRINCIPLES.md §7). Spots and price
 * are decided on the server and only echoed by the labels.
 */
export function QuickDeclareForm({ token, spots, priceGr, parkingTitle }: QuickDeclareFormProps) {
  const [pending, setPending] = useState<Outcome | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<ErrorState>(null);

  async function submit(accept: boolean) {
    setPending(accept ? "accepted" : "declined");
    setError(null);

    try {
      const response = await fetch("/api/host/events/quick-declare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, accept }),
      });

      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof (payload as { error?: { message?: unknown } }).error?.message === "string"
            ? (payload as { error: { message: string } }).error.message
            : "Nie udało się zapisać decyzji. Nic nie zostało zmienione — spróbuj ponownie.";
        setError({ message });
        return;
      }

      setOutcome(accept ? "accepted" : "declined");
    } catch {
      setError({
        message:
          "Brak połączenia. Nic nie zostało zapisane — sprawdź internet i kliknij jeszcze raz.",
      });
    } finally {
      setPending(null);
    }
  }

  if (outcome === "accepted") {
    return (
      <Card>
        <CardBody className="flex flex-col items-start gap-3">
          <Check size={28} aria-hidden="true" className="text-accent" />
          <h2 className="font-display text-h2 font-bold text-ink">Udostępnione</h2>
          <p className="text-body text-ink">
            {parkingTitle}: <span className="num">{spots}</span>{" "}
            {pluralPl(spots, "miejsce", "miejsca", "miejsc")} po {formatMoney(priceGr)}. Kierowcy
            zobaczą Twój parking od razu. Pieniądze trafiają do Ciebie po wydarzeniu.
          </p>
          <p className="text-ui text-muted">
            Zmienisz liczbę miejsc, cenę albo wycofasz udostępnienie w panelu hosta.
          </p>
          <LinkButton href="/panel/wydarzenia" variant="quiet">
            Otwórz panel hosta
          </LinkButton>
        </CardBody>
      </Card>
    );
  }

  if (outcome === "declined") {
    return (
      <Card>
        <CardBody className="flex flex-col items-start gap-3">
          <X size={28} aria-hidden="true" className="text-muted" />
          <h2 className="font-display text-h2 font-bold text-ink">Zapisane</h2>
          <p className="text-body text-ink">
            Tym razem nie udostępniasz {parkingTitle}. Nie przypomnimy o tym wydarzeniu ponownie.
          </p>
          <p className="text-ui text-muted">
            Jeśli zmienisz zdanie, włączysz udostępnienie w panelu hosta do godziny startu.
          </p>
          <LinkButton href="/panel/wydarzenia" variant="quiet">
            Otwórz panel hosta
          </LinkButton>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="rounded-card border border-danger bg-danger-soft p-3 text-body text-ink">
          {error.message}
        </p>
      ) : null}

      <Button
        variant="accent"
        size="lg"
        block
        loading={pending === "accepted"}
        disabled={pending !== null}
        onClick={() => submit(true)}
      >
        Tak, {formatSpots(spots)} po {formatMoney(priceGr)}
      </Button>

      <Button
        variant="quiet"
        size="lg"
        block
        loading={pending === "declined"}
        disabled={pending !== null}
        onClick={() => submit(false)}
      >
        Nie tym razem
      </Button>
    </div>
  );
}
