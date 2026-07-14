"use client";

import { CalendarDays, QrCode, SquareParking, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardMeta,
  CardTitle,
  EmptyState,
  Price,
  Skeleton,
} from "@/components/ui";
import { ROUTES } from "@/components/nav/routes";
import { formatDatePL } from "@/lib/format";

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
  parkingsCount: z.number().optional(),
  payouts: z.array(payoutSchema).default([]),
});

type Earnings = z.infer<typeof earningsSchema>;

type LoadState =
  | { status: "loading" }
  | { status: "ready"; earnings: Earnings }
  | { status: "error"; message: string };

export default function HostDashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });

    fetch("/api/host/earnings", {
      signal: controller.signal,
      credentials: "include",
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const parsed = earningsSchema.safeParse(await response.json());
        if (!parsed.success) throw new Error("Nieoczekiwany kształt odpowiedzi.");
        setState({ status: "ready", earnings: parsed.data });
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setState({
          status: "error",
          message:
            "Nie udało się wczytać zarobków. Twoje pieniądze są bezpieczne — to tylko widok. Odśwież stronę za chwilę.",
        });
      });

    return () => controller.abort();
  }, [attempt]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-h1 font-extrabold text-ink">Pulpit</h1>
        <Button variant="accent" onClick={() => router.push(ROUTES.host.scanner)}>
          Otwórz skaner
        </Button>
      </div>

      {state.status === "loading" ? (
        <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
          <span className="sr-only">Wczytujemy zarobki.</span>
          <Skeleton className="h-28 w-full rounded-card" />
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
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardMeta>Oczekująca wypłata</CardMeta>
                <CardTitle>
                  <Price gr={state.earnings.pendingPayoutGr} size="lg" />
                </CardTitle>
              </CardHeader>
              <CardBody className="pt-2">
                <p className="text-ui text-muted">
                  Wypłacamy raz w tygodniu, po zakończeniu rezerwacji. Kwota jest
                  już po naszej prowizji.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardMeta>Zarobiono łącznie</CardMeta>
                <CardTitle>
                  <Price gr={state.earnings.totalGr} size="lg" />
                </CardTitle>
              </CardHeader>
              <CardBody className="pt-2">
                <p className="text-ui text-muted">
                  Suma wszystkich rozliczonych rezerwacji na Twoich parkingach.
                </p>
              </CardBody>
            </Card>
          </div>

          {state.earnings.parkingsCount === 0 ? (
            <EmptyState
              icon={SquareParking}
              title="Nie masz jeszcze parkingu"
              description="Dodaj miejsce, a pokażemy Ci nadchodzące wydarzenia w jego okolicy i to, ile możesz na nich zarobić."
              action={
                <Button
                  variant="accent"
                  onClick={() => router.push(ROUTES.host.newParking)}
                >
                  Dodaj parking
                </Button>
              }
            />
          ) : null}

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-h3 font-bold text-ink">Wypłaty</h2>
            {state.earnings.payouts.length === 0 ? (
              <p className="text-body text-muted">
                Pierwsza wypłata pojawi się tu po pierwszej zakończonej rezerwacji.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {state.earnings.payouts.map((payout) => (
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
      ) : null}

      <nav aria-label="Skróty" className="grid gap-2 sm:grid-cols-2">
        <ShortcutLink href={ROUTES.host.parkings} label="Moje parkingi" />
        <ShortcutLink href={ROUTES.host.events} label="Nadchodzące wydarzenia" />
        <ShortcutLink href={ROUTES.host.payouts} label="Wypłaty i weryfikacja" />
      </nav>

      <p className="flex items-center gap-2 text-ui text-muted">
        <QrCode size={16} aria-hidden="true" />
        Skaner działa bez internetu, jeśli otworzysz go przed wydarzeniem — kody
        pobierają się z wyprzedzeniem.
      </p>
    </div>
  );
}

function ShortcutLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-touch items-center rounded-card border border-line bg-surface px-3 text-ui font-semibold text-ink transition-colors duration-micro ease-out hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      {label}
    </Link>
  );
}
