import type { Metadata } from "next";
import { Card, CardBody } from "@/components/ui";
import { formatDatePL, formatMoney, formatTimeRangePL } from "@/lib/format";
import { previewQuickDeclare, type QuickDeclareFailure } from "@/modules/events/quick-declare";
import { LinkButton } from "@/modules/events/ui/link-button";
import { QuickDeclareForm } from "./quick-declare-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Udostępnij parking",
  robots: { index: false, follow: false },
};

/** Errors say what happened, whether it cost money, and what to do next — in that order. */
const FAILURE_COPY: Record<QuickDeclareFailure, { title: string; body: string }> = {
  TOKEN_INVALID: {
    title: "Ten link nie działa",
    body: "Nie rozpoznajemy tego linku. Nic nie zostało zmienione i nic Cię to nie kosztowało. Zaloguj się i ustaw dostępność w panelu hosta.",
  },
  TOKEN_USED: {
    title: "Ten link został już użyty",
    body: "Twoja decyzja jest zapisana. Zmienisz ją w panelu hosta — do godziny startu wydarzenia.",
  },
  TOKEN_EXPIRED: {
    title: "Za późno na ten link",
    body: "Wydarzenie już się zaczęło, więc link wygasł. Kolejne wydarzenia znajdziesz w panelu hosta.",
  },
  PARKING_NOT_OWNED: {
    title: "Ten parking nie jest Twój",
    body: "Nie możemy przypisać tej decyzji do Twojego konta. Zaloguj się i ustaw dostępność w panelu hosta.",
  },
};

type PageProps = { params: Promise<{ token: string }> };

export default async function QuickDeclarePage({ params }: PageProps) {
  const { token } = await params;
  const preview = await previewQuickDeclare(token);

  if (!preview.ok) {
    const copy = FAILURE_COPY[preview.reason];
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-16 pt-10">
        <Card>
          <CardBody className="flex flex-col items-start gap-3">
            <h1 className="font-display text-h2 font-bold text-ink">{copy.title}</h1>
            <p className="text-body text-muted">{copy.body}</p>
            <LinkButton href="/panel/wydarzenia" variant="quiet">
              Otwórz panel hosta
            </LinkButton>
          </CardBody>
        </Card>
      </main>
    );
  }

  const offer = preview.value;
  const parkingTitle = offer.parkingTitle ?? "Twój parking";

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pb-16 pt-10">
      <header className="flex flex-col gap-2">
        <p className="num text-ui text-muted">
          {formatDatePL(offer.startsAt)} · {formatTimeRangePL(offer.startsAt, offer.endsAt)} ·{" "}
          {offer.venueName}
        </p>
        <h1 className="font-display text-h1 font-extrabold text-ink">
          Udostępniasz parking na {offer.eventTitle}?
        </h1>
        <p className="text-body text-muted">
          {parkingTitle}. Proponujemy <span className="num">{offer.spots}</span> miejsc po{" "}
          {formatMoney(offer.priceGr)}. Liczbę miejsc i cenę zmienisz później w panelu.
        </p>
      </header>

      <QuickDeclareForm
        token={token}
        spots={offer.spots}
        priceGr={offer.priceGr}
        parkingTitle={parkingTitle}
      />
    </main>
  );
}
