"use client";

import { AlertCircle, CalendarDays, ShieldCheck, Wallet } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardMeta,
  CardTitle,
  Price,
  Skeleton,
} from "@/components/ui";
import { formatDatePL } from "@/lib/format";

const statusSchema = z.object({
  connected: z.boolean(),
  chargesEnabled: z.boolean(),
  payoutsEnabled: z.boolean(),
  required: z.boolean(),
});

const payoutSchema = z.object({
  id: z.string(),
  amountGr: z.int(),
  status: z.enum(["PENDING", "PAID", "FAILED"]),
  paidAt: z.string().nullable().optional(),
  periodEnd: z.string().nullable().optional(),
});

const earningsSchema = z.object({
  totalGr: z.int(),
  pendingPayoutGr: z.int(),
  payouts: z.array(payoutSchema).default([]),
});

type Status = z.infer<typeof statusSchema>;
type Earnings = z.infer<typeof earningsSchema>;

type LoadState =
  | { status: "loading" }
  | { status: "ready"; onboarding: Status; earnings: Earnings }
  | { status: "error"; message: string };

export function PayoutsScreen() {
  const params = useSearchParams();
  // Stripe just sent the host back from the hosted form. The webhook that flips
  // the flags lands a second or two later, and the host is looking at this page
  // *now* — so this one render asks Stripe directly instead of showing them a
  // stale "verification pending" they just finished.
  const returning = params.get("onboarding") === "powrot";

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [redirecting, setRedirecting] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });

    const get = async (url: string) => {
      const response = await fetch(url, {
        signal: controller.signal,
        credentials: "include",
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    };

    Promise.all([
      get(`/api/host/stripe/status${returning ? "?refresh=true" : ""}`),
      get("/api/host/earnings"),
    ])
      .then(([rawStatus, rawEarnings]) => {
        const onboarding = statusSchema.safeParse(rawStatus);
        const earnings = earningsSchema.safeParse(rawEarnings);
        if (!onboarding.success || !earnings.success) {
          throw new Error("Nieoczekiwany kształt odpowiedzi.");
        }
        setState({ status: "ready", onboarding: onboarding.data, earnings: earnings.data });
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setState({
          status: "error",
          message:
            "Nie udało się wczytać stanu wypłat. Twoje pieniądze są bezpieczne — to tylko widok. Spróbuj ponownie za chwilę.",
        });
      });

    return () => controller.abort();
  }, [attempt, returning]);

  /**
   * The link is single-use and short-lived, so it is fetched on the click and
   * used immediately. Nothing is stored: a saved onboarding URL is a dead link
   * by the time anyone clicks it twice.
   */
  const startOnboarding = useCallback(async () => {
    setRedirecting(true);
    setLinkError(null);

    try {
      const response = await fetch("/api/host/stripe/onboard", {
        method: "POST",
        credentials: "include",
        headers: { accept: "application/json" },
      });

      const body = await response.json();

      if (!response.ok || typeof body?.url !== "string") {
        setLinkError(
          body?.error?.message ??
            "Nie udało się otworzyć weryfikacji. Nic nie zostało zmienione — spróbuj ponownie za chwilę.",
        );
        setRedirecting(false);
        return;
      }

      window.location.href = body.url;
    } catch {
      setLinkError("Straciliśmy połączenie. Sprawdź internet i spróbuj ponownie.");
      setRedirecting(false);
    }
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <h1 className="font-display text-h1 font-extrabold text-ink">Wypłaty</h1>

      {state.status === "loading" ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <span className="sr-only">Wczytujemy stan wypłat.</span>
          <Skeleton className="h-40 w-full rounded-card" />
          <Skeleton className="h-28 w-full rounded-card" />
        </div>
      ) : null}

      {state.status === "error" ? (
        <Card className="border-danger">
          <CardBody className="flex flex-col items-start gap-3">
            <p className="text-body text-ink">{state.message}</p>
            <Button variant="quiet" onClick={() => setAttempt((value) => value + 1)}>
              Spróbuj ponownie
            </Button>
          </CardBody>
        </Card>
      ) : null}

      {state.status === "ready" ? (
        state.onboarding.required && !state.onboarding.payoutsEnabled ? (
          <VerificationNeeded
            onboarding={state.onboarding}
            busy={redirecting}
            error={linkError}
            onStart={startOnboarding}
          />
        ) : (
          <Settled earnings={state.earnings} verified={state.onboarding.payoutsEnabled} />
        )
      ) : null}
    </div>
  );
}

/**
 * The blocking state. It says the one thing the host needs to know — their
 * parking will not be sold until this is done — and then gets out of the way with
 * a single button. No progress bars, no reassurance about how quick it is: it is
 * Stripe's form and we do not know how long it takes them.
 */
function VerificationNeeded({
  onboarding,
  busy,
  error,
  onStart,
}: {
  onboarding: Status;
  busy: boolean;
  error: string | null;
  onStart: () => void;
}) {
  // Charges on, payouts off: Stripe took the account but is still holding the
  // money side — usually a missing document. Worth saying plainly, because the
  // host has already filled in a form once and deserves to know why they are back.
  const inReview = onboarding.connected && onboarding.chargesEnabled;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <CardTitle>
            {onboarding.connected ? "Weryfikacja niedokończona" : "Zanim zaczniesz zarabiać"}
          </CardTitle>
          <Badge tone="neutral" icon={ShieldCheck}>
            {inReview ? "W trakcie" : "Wymagana"}
          </Badge>
        </CardHeader>
        <CardBody className="flex flex-col gap-4 pt-2">
          <p className="text-body text-ink">
            {inReview
              ? "Stripe ma już Twoje konto, ale nie zwolnił jeszcze wypłat — zwykle brakuje jednego dokumentu. Dokończ weryfikację, a wrócimy do sprzedaży."
              : "Wypłaty obsługuje Stripe. Potwierdź swoją tożsamość i podaj numer konta — inaczej nie mamy jak przelać Ci pieniędzy za rezerwacje."}
          </p>

          <p className="text-body text-muted">
            Do tego czasu Twoje parkingi nie trafią do sprzedaży. Nie sprzedajemy miejsc, za które
            nie umiemy zapłacić.
          </p>

          {error ? (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-card border border-danger bg-surface p-3"
            >
              <AlertCircle size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-danger" />
              <p className="text-ui text-ink">{error}</p>
            </div>
          ) : null}

          <Button variant="accent" size="lg" onClick={onStart} loading={busy}>
            Dokończ weryfikację w Stripe
          </Button>

          <p className="text-ui text-muted">
            Przeniesiemy Cię na stronę Stripe. Twoich danych osobowych ani numeru konta nie
            przechowujemy.
          </p>
        </CardBody>
      </Card>
    </>
  );
}

/** The normal state: money in, money out, nothing in the way. */
function Settled({ earnings, verified }: { earnings: Earnings; verified: boolean }) {
  return (
    <>
      {verified ? (
        <p className="flex items-center gap-2 text-ui text-muted">
          <ShieldCheck size={16} aria-hidden="true" />
          Weryfikacja w Stripe ukończona. Wypłacamy co tydzień, w poniedziałki.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardMeta>Oczekująca wypłata</CardMeta>
            <CardTitle>
              <Price gr={earnings.pendingPayoutGr} size="lg" />
            </CardTitle>
          </CardHeader>
          <CardBody className="pt-2">
            <p className="text-ui text-muted">
              Kwota po naszej prowizji, za rezerwacje, które już się odbyły.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardMeta>Zarobiono łącznie</CardMeta>
            <CardTitle>
              <Price gr={earnings.totalGr} size="lg" />
            </CardTitle>
          </CardHeader>
          <CardBody className="pt-2">
            <p className="text-ui text-muted">Suma wszystkich rozliczonych wypłat.</p>
          </CardBody>
        </Card>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-h3 font-bold text-ink">Historia wypłat</h2>
        {earnings.payouts.length === 0 ? (
          <p className="text-body text-muted">
            Pierwsza wypłata pojawi się tu po pierwszej zakończonej rezerwacji.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {earnings.payouts.map((payout) => (
              <li
                key={payout.id}
                className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface p-3"
              >
                <span className="flex flex-col">
                  <Price gr={payout.amountGr} />
                  <span className="num text-ui text-muted">
                    {payout.paidAt
                      ? formatDatePL(payout.paidAt)
                      : payout.periodEnd
                        ? `za okres do ${formatDatePL(payout.periodEnd)}`
                        : "termin zostanie ustalony"}
                  </span>
                </span>
                <Badge
                  icon={payout.status === "PAID" ? Wallet : CalendarDays}
                  tone={
                    payout.status === "PAID"
                      ? "ok"
                      : payout.status === "FAILED"
                        ? "bad"
                        : "neutral"
                  }
                >
                  {payout.status === "PAID"
                    ? "Wypłacona"
                    : payout.status === "FAILED"
                      ? "Nieudana"
                      : "Oczekuje"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
