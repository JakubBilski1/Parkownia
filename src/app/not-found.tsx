import Link from "next/link";
import { ROUTES } from "@/components/nav/routes";

/**
 * States what happened, whether it cost money, and what to do next — in that
 * order. No apology, no "Ups!".
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-4 p-6">
      <p className="num font-mono text-ui text-muted">404</p>
      <h1 className="font-display text-h1 font-extrabold text-ink">
        Tej strony nie ma
      </h1>
      <p className="text-body text-muted">
        Link mógł się zmienić albo rezerwacja, do której prowadził, wygasła.
        Żadna płatność nie została pobrana.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href={ROUTES.map}
          className="inline-flex min-h-touch items-center justify-center rounded-button bg-accent px-4 font-semibold text-accent-ink transition-colors duration-micro ease-out hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Wróć na mapę
        </Link>
        <Link
          href={ROUTES.bookings}
          className="inline-flex min-h-touch items-center justify-center rounded-button border border-line bg-surface px-4 font-semibold text-ink transition-colors duration-micro ease-out hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Moje rezerwacje
        </Link>
      </div>
    </main>
  );
}
