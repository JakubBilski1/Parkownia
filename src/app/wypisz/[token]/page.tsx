import type { Metadata } from "next";
import { Card, CardBody } from "@/components/ui";
import { UnsubscribeForm } from "./unsubscribe-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wypisz się z wiadomości",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ token: string }> };

/**
 * The page behind the link in every campaign footer.
 *
 * It asks before it acts, and that is deliberate rather than lazy: corporate
 * mail scanners and inbox previewers fetch every URL in a message, and a GET
 * that unsubscribed on sight would quietly cut people off lists they never left.
 * The confirmation is one button, no login, no form to fill — the cost of the
 * extra click is a second, and the cost of getting it wrong is a list that
 * silently drains.
 *
 * The one-click path RFC 8058 asks for is the POST at /api/wypisz/[token]; that
 * one is safe without a confirmation because only a mail client's unsubscribe
 * button ever issues it.
 */
export default async function UnsubscribePage({ params }: PageProps) {
  const { token } = await params;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-16 pt-10">
      <Card>
        <CardBody className="flex flex-col items-start gap-3">
          <h1 className="font-display text-h2 font-bold text-ink">
            Wypisać Cię z naszych wiadomości?
          </h1>
          <p className="text-body text-muted">
            Przestaniemy pisać do Ciebie o wynajmie miejsc parkingowych. Twój adres trafi na
            listę wykluczeń, więc nie dostaniesz od nas kolejnej takiej wiadomości, nawet
            przez pomyłkę.
          </p>
          <p className="text-ui text-muted">
            To nie dotyczy wiadomości o Twoich rezerwacjach — kod wjazdu dostaniesz zawsze.
          </p>
          <UnsubscribeForm token={token} />
        </CardBody>
      </Card>
    </main>
  );
}
