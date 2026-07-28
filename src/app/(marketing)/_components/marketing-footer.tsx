import Link from "next/link";

/**
 * A typographic rendition of the PB Devs mark ("PB | DEVS"), not their SVG —
 * there is no asset in this repo. Drop one at public/pbdevs.svg and this becomes
 * an <Image>; until then this keeps the shape of the wordmark without pretending
 * to be the logo file.
 */
function PbDevsMark() {
  return (
    <span className="inline-flex items-baseline gap-1.5" aria-hidden="true">
      <span className="font-display text-ui font-extrabold tracking-tight">PB</span>
      <span className="h-3 w-px translate-y-0.5 bg-current opacity-40" />
      <span className="text-ui font-medium tracking-[0.18em]">DEVS</span>
    </span>
  );
}

/**
 * Thin on purpose: one row on a desktop, two on a phone.
 *
 * The controller's name and home address used to be printed here on every page.
 * They now sit where the law actually wants them — §1 of the privacy policy and
 * §1 of the terms, both one click away from this row. A footer is not the place
 * to serve somebody's postal address to every visitor and every crawler.
 */
export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between lg:px-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Link
            href="/"
            className="rounded-chip font-display text-ui font-extrabold tracking-tight text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Parkownia
          </Link>
          <span className="text-ui text-muted">Parking na mecz i targi w Poznaniu.</span>
        </div>

        <nav aria-label="Stopka" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-ui">
          <a
            href="mailto:kontakt@parkownia.com"
            className="rounded-chip text-ink underline underline-offset-4"
          >
            kontakt@parkownia.com
          </a>
          <Link
            href="/prywatnosc"
            className="rounded-chip text-muted underline underline-offset-4 transition-colors duration-micro hover-hover:hover:text-ink"
          >
            Prywatność
          </Link>
          <Link
            href="/regulamin"
            className="rounded-chip text-muted underline underline-offset-4 transition-colors duration-micro hover-hover:hover:text-ink"
          >
            Regulamin
          </Link>
          <a
            href="https://pbdevs.com"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 rounded-chip text-muted transition-colors duration-micro hover-hover:hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <span>Built by</span>
            <PbDevsMark />
            <span className="sr-only">PB Devs — otwiera się w nowej karcie</span>
          </a>
        </nav>
      </div>
    </footer>
  );
}
