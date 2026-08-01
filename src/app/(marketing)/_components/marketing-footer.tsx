import Image from "next/image";
import Link from "next/link";
import pbDevsOnDark from "@/../public/brand/pbdevs-on-dark.png";
import pbDevsOnLight from "@/../public/brand/pbdevs-on-light.png";

/**
 * The real PB Devs wordmark, taken from pbdevs.com. It is one colour on
 * transparency and cannot be recoloured, so both tones ship and CSS hides one
 * (.on-light-only / .on-dark-only in globals.css).
 *
 * The mark carries the link's accessible name — this is somebody else's brand,
 * so it is named rather than left to the surrounding text.
 */
function PbDevsMark() {
  return (
    <>
      <Image
        src={pbDevsOnLight}
        alt="PB Devs"
        height={14}
        className="on-light-only w-auto"
        // 21 KB below the fold on every marketing page; never worth a
        // render-blocking fetch.
        loading="lazy"
      />
      <Image
        src={pbDevsOnDark}
        alt="PB Devs"
        height={14}
        className="on-dark-only w-auto"
        loading="lazy"
      />
    </>
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
            className="inline-flex items-center gap-2 rounded-chip text-muted transition-colors duration-micro hover-hover:hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <span>Built by</span>
            {/* The mark's alt is the name; the hidden copy only adds what a
                sighted user gets from the icon-less new-tab convention. */}
            <PbDevsMark />
            <span className="sr-only">— otwiera się w nowej karcie</span>
          </a>
        </nav>
      </div>
    </footer>
  );
}
