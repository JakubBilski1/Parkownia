"use client";

import { Lock } from "lucide-react";
import { useState } from "react";
import { Badge, Switch, useToast } from "@/components/ui";
import { formatDateTimePL } from "@/lib/format";
import { NETWORK_ERROR, readApiError } from "./api-error";

/** What the server sends: ConsentState with dates already serialised. */
export type ConsentView = {
  kind: "TERMS" | "PRIVACY" | "MARKETING_EMAIL" | "MARKETING_SMS";
  granted: boolean;
  documentVersion: string | null;
  grantedAt: string | null;
  withdrawnAt: string | null;
};

type MarketingKind = "MARKETING_EMAIL" | "MARKETING_SMS";

const LABEL: Record<ConsentView["kind"], string> = {
  TERMS: "Regulamin",
  PRIVACY: "Polityka prywatności",
  MARKETING_EMAIL: "Powiadomienia marketingowe e-mailem",
  MARKETING_SMS: "Powiadomienia marketingowe SMS-em",
};

const MARKETING_HINT: Record<MarketingKind, string> = {
  MARKETING_EMAIL: "Nowe wydarzenia i promocje. Nie dotyczy maili o Twoich rezerwacjach — te wysyłamy zawsze.",
  MARKETING_SMS: "Nie dotyczy SMS-a z kodem wjazdu — ten dostaniesz niezależnie od tej zgody.",
};

/** The API speaks camelCase; the table speaks enum kinds. */
const FIELD: Record<MarketingKind, "marketingEmail" | "marketingSms"> = {
  MARKETING_EMAIL: "marketingEmail",
  MARKETING_SMS: "marketingSms",
};

function historyLine(consent: ConsentView): string {
  if (consent.granted && consent.grantedAt) {
    const version = consent.documentVersion ? ` · wersja ${consent.documentVersion}` : "";
    return `Udzielona ${formatDateTimePL(consent.grantedAt)}${version}`;
  }
  if (consent.withdrawnAt) {
    return `Wycofana ${formatDateTimePL(consent.withdrawnAt)}`;
  }
  return "Nieudzielona";
}

export function ConsentsPanel({ initial }: { initial: ConsentView[] }) {
  const { toast } = useToast();
  const [consents, setConsents] = useState(initial);
  const [pending, setPending] = useState<MarketingKind | null>(null);

  const required = consents.filter(
    (consent) => consent.kind === "TERMS" || consent.kind === "PRIVACY",
  );
  const marketing = consents.filter(
    (consent): consent is ConsentView & { kind: MarketingKind } =>
      consent.kind === "MARKETING_EMAIL" || consent.kind === "MARKETING_SMS",
  );

  const toggle = async (kind: MarketingKind, next: boolean) => {
    const previous = consents;

    // Optimistic: a switch that waits for a round-trip feels broken (§6.1).
    setConsents((current) =>
      current.map((consent) =>
        consent.kind === kind ? { ...consent, granted: next } : consent,
      ),
    );
    setPending(kind);

    try {
      const response = await fetch("/api/me/consents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ [FIELD[kind]]: next }),
      });

      if (!response.ok) {
        const error = await readApiError(response);
        setConsents(previous);
        toast({
          tone: "error",
          message: "Nie zapisaliśmy zmiany zgody.",
          detail: error.message,
        });
        return;
      }

      const body: { consents?: ConsentView[] } = await response.json();
      if (body.consents) setConsents(body.consents);

      toast({
        tone: "ok",
        message: next ? "Zgoda udzielona." : "Zgoda wycofana.",
      });
    } catch {
      setConsents(previous);
      toast({
        tone: "error",
        message: "Nie zapisaliśmy zmiany zgody.",
        detail: NETWORK_ERROR.message,
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {required.map((consent) => (
          <li
            key={consent.kind}
            className="flex flex-col gap-1 rounded-card border border-line bg-surface-2 p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-body font-semibold text-ink">
                {LABEL[consent.kind]}
              </span>
              <Badge tone="neutral" icon={Lock}>
                Wymagana
              </Badge>
            </div>
            <p className="num text-ui text-muted">{historyLine(consent)}</p>
          </li>
        ))}
      </ul>

      <p className="text-ui text-muted">
        Regulaminu i polityki prywatności nie da się wycofać, dopóki masz konto — bez nich
        nie mamy podstawy, żeby je prowadzić. Wycofanie tych zgód oznacza usunięcie konta:
        sekcja na dole tej strony.
      </p>

      <ul className="flex flex-col gap-2 border-t border-line pt-2">
        {marketing.map((consent) => (
          <li key={consent.kind}>
            <Switch
              label={LABEL[consent.kind]}
              hint={
                <>
                  {MARKETING_HINT[consent.kind]}
                  <span className="num mt-0.5 block">{historyLine(consent)}</span>
                </>
              }
              checked={consent.granted}
              disabled={pending === consent.kind}
              onChange={(event) => void toggle(consent.kind, event.target.checked)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
