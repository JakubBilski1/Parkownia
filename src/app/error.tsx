"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";
import { ROUTES } from "@/components/nav/routes";

/**
 * What happened → did it cost money → what to do next (DESIGN_PRINCIPLES 6.10).
 * The digest is shown because it is the only thing support can act on; the
 * message itself never blames the driver and never apologises.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // No payload, no personal data — only the identifier the server already logged.
    console.error("Render error", error.digest ?? "(brak identyfikatora)");
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-4 p-6">
      <h1 className="font-display text-h1 font-extrabold text-ink">
        Ten ekran się nie wczytał
      </h1>
      <p className="text-body text-muted">
        Błąd wystąpił po naszej stronie. Jeśli byłeś w trakcie płatności — sprawdź
        swoje rezerwacje, zanim zapłacisz drugi raz. Nie pobieramy pieniędzy za
        rezerwację, której nie widzisz na liście.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="accent" onClick={reset}>
          Spróbuj ponownie
        </Button>
        <Button
          variant="quiet"
          onClick={() => window.location.assign(ROUTES.bookings)}
        >
          Sprawdź moje rezerwacje
        </Button>
      </div>

      {error.digest ? (
        <p className="num font-mono text-ui text-muted">
          Identyfikator błędu: {error.digest}
        </p>
      ) : null}
    </main>
  );
}
