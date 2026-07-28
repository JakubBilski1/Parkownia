import type { Metadata } from "next";
import { Suspense } from "react";
import { Calculator } from "./_components/calculator/calculator";
import { loadVenueAnchors } from "./_components/calculator/venues-data";
import { Cta } from "./_components/cta";
import { Effort } from "./_components/effort";
import { Faq } from "./_components/faq";
import { Hero } from "./_components/hero";
import { HowItWorks } from "./_components/how-it-works";
import { JsonLd } from "./_components/jsonld";
import { Scale } from "./_components/scale";
import { SectionHead } from "./_components/section-head";

// Dynamic, not static: the Scale section reads the events table, and the build
// (docker build) runs with no database reachable — same reason /wydarzenia is
// force-dynamic. The page is still light (server HTML + one client island), so
// this does not cost Core Web Vitals.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Zarabiaj na pustym parkingu w dni meczowe",
  description:
    "Masz plac, podjazd albo parking firmowy blisko Enea Stadionu lub MTP? Udostępniaj go na wydarzenia — kierowcy rezerwują i płacą z góry. Policz szacowany zarobek w 60 sekund.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Zarabiaj na pustym parkingu w dni meczowe — Parkownia",
    description:
      "Udostępniaj miejsce blisko Enea Stadionu i MTP. Bez gotówki, bez negocjacji. Policz zarobek w 60 sekund.",
    url: "/",
    type: "website",
  },
};

export default function OwnersLandingPage() {
  return (
    <>
      <JsonLd />
      <Hero />
      {/* Reads search params (shareable link) — needs a Suspense boundary. */}
      <Suspense fallback={<CalculatorFallback />}>
        <CalculatorSection />
      </Suspense>
      <HowItWorks />
      <Effort />
      {/* async server component — reads real event data */}
      <Scale />
      <Faq />
      {/* Last on the page on purpose — see cta.tsx. */}
      <Cta />
    </>
  );
}

/**
 * Reads the venue coordinates on the server so the map can mark Enea and MTP
 * from the first frame, then hands them to the client island. Inside the same
 * Suspense boundary the island already needed, so the query does not hold up
 * the rest of the page.
 */
async function CalculatorSection() {
  return <Calculator anchors={await loadVenueAnchors()} />;
}

// The static shell of the calculator section, shown for the instant before the
// client island mounts — same header, same map box, so nothing jumps.
function CalculatorFallback() {
  return (
    <section id="kalkulator" className="border-b border-line bg-bg">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20 lg:px-6">
        <SectionHead
          label="Kalkulator"
          title="Policz swój zarobek"
          lead="Wpisz adres obiektu — policzymy dojście do Enea Stadionu i MTP, liczbę wydarzeń w zasięgu i szacowany roczny przychód."
        />
        <div className="mt-12 grid gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <div className="h-touch w-full rounded-button border border-line bg-surface" />
          </div>
          <div className="h-[320px] w-full rounded-card border border-line bg-surface sm:h-[400px] lg:col-span-7 lg:h-[460px]" />
        </div>
      </div>
    </section>
  );
}
