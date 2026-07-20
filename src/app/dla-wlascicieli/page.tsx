import type { Metadata } from "next";
import { Suspense } from "react";
import { Calculator } from "./_components/calculator/calculator";
import { Effort } from "./_components/effort";
import { Faq } from "./_components/faq";
import { Hero } from "./_components/hero";
import { HowItWorks } from "./_components/how-it-works";
import { JsonLd } from "./_components/jsonld";
import { Scale } from "./_components/scale";

// Dynamic, not static: the Scale section reads the events table, and the build
// (docker build) runs with no database reachable — same reason /wydarzenia is
// force-dynamic. The page is still light (server HTML + one client island), so
// this does not cost Core Web Vitals.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Zarabiaj na pustym parkingu w dni meczowe",
  description:
    "Masz plac, podjazd albo parking firmowy blisko Enea Stadionu lub MTP? Udostępniaj go na wydarzenia — kierowcy rezerwują i płacą z góry. Policz szacowany zarobek w 60 sekund.",
  alternates: { canonical: "/dla-wlascicieli" },
  openGraph: {
    title: "Zarabiaj na pustym parkingu w dni meczowe — Parkownia",
    description:
      "Udostępniaj miejsce blisko Enea Stadionu i MTP. Bez gotówki, bez negocjacji. Policz zarobek w 60 sekund.",
    url: "/dla-wlascicieli",
    type: "website",
  },
};

export default function DlaWlascicieliPage() {
  return (
    <>
      <JsonLd />
      <Hero />
      {/* Reads search params (shareable link) — needs a Suspense boundary. */}
      <Suspense fallback={<CalculatorFallback />}>
        <Calculator />
      </Suspense>
      <HowItWorks />
      <Effort />
      {/* async server component — reads real event data */}
      <Scale />
      <Faq />
    </>
  );
}

// The static shell of the calculator section, shown for the instant before the
// client island mounts — same box, so nothing jumps.
function CalculatorFallback() {
  return (
    <section id="kalkulator" className="border-b border-line bg-surface-2">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20 lg:px-6">
        <h2 className="font-display text-h1 font-extrabold tracking-tight text-ink">
          Policz swój zarobek
        </h2>
        <p className="mt-3 max-w-2xl text-lead text-muted">
          Wpisz adres obiektu — policzymy dojście do Enea Stadionu i MTP, liczbę wydarzeń w zasięgu
          i szacowany roczny przychód.
        </p>
        <div className="mt-8 h-[300px] w-full rounded-card border border-line bg-surface sm:h-[340px]" />
      </div>
    </section>
  );
}
