import Link from "next/link";

/**
 * The shell layout (owned by the navigation module) does not check roles, so every
 * admin page checks for itself. A missing guard here is a money leak, not a typo.
 */
export function AccessDenied() {
  return (
    <div className="flex max-w-[32rem] flex-col gap-3 py-10">
      <h1 className="font-display text-h2 font-extrabold text-ink">Brak dostępu</h1>
      <p className="text-body text-muted">
        Panel administratora wymaga konta z rolą administratora. Zaloguj się takim kontem albo wróć
        na stronę główną.
      </p>
      <Link
        href="/"
        className="inline-flex min-h-touch w-fit items-center rounded-button border border-line bg-surface px-4 text-body font-semibold text-ink transition-colors duration-micro ease-out hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        Strona główna
      </Link>
    </div>
  );
}
