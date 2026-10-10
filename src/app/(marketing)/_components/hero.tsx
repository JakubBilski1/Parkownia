import Link from "next/link";
import { ROUTES } from "@/components/nav/routes";
import { buttonVariants } from "@/components/ui";
import { cn } from "@/lib/cn";
import { COMMISSION_PCT } from "@/modules/leads/calc";
import { FixturesPanel } from "./fixtures";
import { loadFixtures } from "./fixtures-data";

// Three claims we can actually stand behind — mechanics, not metrics. No
// "10 000+ zadowolonych kierowców" until it is true (§1).
const FACTS = [
  { term: "Płatność z góry", detail: "BLIK albo karta — zanim kierowca ruszy spod domu." },
  {
    term: `Prowizja ${COMMISSION_PCT.business}%`,
    detail: "Tyle samo dla osoby prywatnej i firmy. Potrącana automatycznie.",
  },
  { term: "Wjazd na kod QR", detail: "Skanujesz telefonem. Działa też bez internetu." },
];

/**
 * Two columns that argue with each other on purpose: the claim on the left, the
 * evidence on the right. The fixture list is real data from our own events
 * table, so the page dates itself instead of asserting momentum.
 *
 * With no fixtures to show the hero collapses to one measured column instead of
 * leaving a hole — the layout follows the content, not the other way round.
 */
export async function Hero() {
  const fixtures = await loadFixtures();

  return (
    <section className="border-b border-line bg-bg">
      <div className="mx-auto w-full max-w-6xl px-4 lg:px-6">
        {/* grid-cols-1 is not decoration: without an explicit track the single
            implicit column sizes to min-content, and the fixture rows' nowrap
            titles pushed it to 478px on a 390px phone — the whole page scrolled
            sideways. minmax(0,1fr) lets the column shrink and `truncate` work. */}
        <div
          className={cn(
            "grid grid-cols-1 gap-10 py-14 sm:py-20 lg:gap-10",
            fixtures ? "lg:grid-cols-12" : "",
          )}
        >
          <div className={fixtures ? "lg:col-span-7" : "max-w-3xl"}>
            <p className="flex items-center gap-3 text-ui font-semibold uppercase tracking-[0.12em] text-muted">
              <span aria-hidden="true" className="h-px w-6 bg-line" />
              Dla właścicieli miejsc
              <span aria-hidden="true" className="h-px flex-1 bg-line" />
              <span className="text-ink">Poznań</span>
            </p>

            {/* Marketing hero size only — the app's 6-level scale tops out at h1
                (36px); a responsive clamp keeps that scale intact (§3). */}
            <h1 className="mt-6 font-display text-[clamp(2.5rem,7vw,3.75rem)] font-extrabold leading-[1.02] tracking-[-0.025em] text-ink">
              Twój plac stoi pusty w sobotę. W dzień meczu to są pieniądze.
            </h1>

            <p className="mt-6 max-w-xl text-lead text-muted">
              Masz miejsce blisko Enea Stadionu albo MTP? Udostępniaj je na konkretne wydarzenia —
              kierowcy rezerwują i płacą z góry. Bez gotówki, bez negocjacji, bez telefonów.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#kalkulator" className={buttonVariants({ variant: "accent", size: "lg" })}>
                Policz, ile zarobisz
              </a>
              <a href="#jak-to-dziala" className={buttonVariants({ variant: "quiet", size: "lg" })}>
                Jak to działa
              </a>
            </div>

            {/* The way into the working product. A landing that only talks is a
                leaflet; an owner who can click through to the map sees that the
                thing exists. */}
            <p className="mt-6 text-ui text-muted">
              Chcesz najpierw zobaczyć, jak to działa od strony kierowcy?{" "}
              <Link
                href={ROUTES.map}
                className="rounded-button text-ink underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                Otwórz mapę parkingów
              </Link>
              .
            </p>
          </div>

          {fixtures ? (
            <div className="lg:col-span-5">
              <FixturesPanel data={fixtures} />
            </div>
          ) : null}
        </div>

        <dl className="grid border-t border-line sm:grid-cols-3">
          {FACTS.map((fact) => (
            <div
              key={fact.term}
              className="border-b border-line py-5 sm:border-b-0 sm:border-r sm:px-6 sm:py-6 sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0"
            >
              <dt className="text-body font-semibold text-ink">{fact.term}</dt>
              <dd className="mt-1 text-ui text-muted">{fact.detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
