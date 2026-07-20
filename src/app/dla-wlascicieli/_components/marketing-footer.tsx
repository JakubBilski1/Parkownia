import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 lg:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-display text-h3 font-extrabold tracking-tight text-ink">Parkownia</p>
            <p className="mt-2 text-ui text-muted">Parking na mecz i targi w Poznaniu.</p>
          </div>
          <nav aria-label="Stopka" className="flex flex-col gap-2 text-ui">
            <a
              href="mailto:kontakt@parkownia.com"
              className="rounded-chip text-ink underline underline-offset-4"
            >
              kontakt@parkownia.com
            </a>
            <Link
              href="/prywatnosc"
              className="rounded-chip text-muted underline underline-offset-4 hover:text-ink"
            >
              Polityka prywatności
            </Link>
            <Link
              href="/regulamin"
              className="rounded-chip text-muted underline underline-offset-4 hover:text-ink"
            >
              Regulamin
            </Link>
          </nav>
        </div>

        <div className="mt-8 border-t border-line pt-6 text-ui text-muted">
          {/* Administrator danych podany świadomie jako publiczny (decyzja właściciela, 2026-07-20). */}
          {/* TODO(legal): potwierdzić kod pocztowy oraz pełną klauzulę po audycie radcy — patrz docs/LEGAL_RESEARCH.md §2.1. */}
          <p>
            Administrator danych osobowych: Jakub Bilski, ul. Krótka 10a, Mosina. W sprawach danych
            pisz na{" "}
            <a href="mailto:kontakt@parkownia.com" className="underline underline-offset-4">
              kontakt@parkownia.com
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
