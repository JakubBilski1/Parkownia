"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { commissionPctFor, revenueEstimate } from "@/modules/leads/calc";
import { SectionHead } from "../section-head";
import { AddressField } from "./address-field";
import { LeadWizard } from "./lead-wizard";
import { ReachMap } from "./reach-map";
import { RevenuePanel } from "./revenue-panel";
import type { GeocodeItem, OwnerKind, ReachData } from "./types";

type Point = { lat: number; lng: number };

export function Calculator() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [address, setAddress] = useState("");
  const [point, setPoint] = useState<Point | null>(null);
  const [spots, setSpots] = useState(20);
  const [ownerKind, setOwnerKind] = useState<OwnerKind>("INDIVIDUAL");
  const [rateGr, setRateGr] = useState<number | null>(null);
  const [reach, setReach] = useState<ReachData | null>(null);
  const [reachLoading, setReachLoading] = useState(false);
  const [reachError, setReachError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const hydrated = useRef(false);

  // Hydrate once from the query string, so a cold-mail link like
  // /?adres=…&miejsca=30 arrives pre-filled.
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const adres = searchParams.get("adres");
    const lat = Number(searchParams.get("lat"));
    const lng = Number(searchParams.get("lng"));
    const miejsca = Number(searchParams.get("miejsca"));
    const stawka = Number(searchParams.get("stawka"));
    if (adres) setAddress(adres);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
      setPoint({ lat, lng });
    }
    if (Number.isFinite(miejsca) && miejsca >= 1 && miejsca <= 100) setSpots(Math.round(miejsca));
    if (Number.isFinite(stawka) && stawka > 0) setRateGr(Math.round(stawka) * 100);
    setReady(true);
  }, [searchParams]);

  // Recompute reach whenever the point changes.
  useEffect(() => {
    if (!point) {
      setReach(null);
      return;
    }
    const ctrl = new AbortController();
    setReachLoading(true);
    setReachError(null);
    fetch(`/api/dla-wlascicieli/potencjal?lat=${point.lat}&lng=${point.lng}`, { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("reach"))))
      .then((data: ReachData) => {
        setReach(data);
        setRateGr((prev) => prev ?? data.rate?.midGr ?? null);
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") {
          setReachError("Nie udało się policzyć potencjału. Spróbuj ponownie.");
        }
      })
      .finally(() => setReachLoading(false));
    return () => ctrl.abort();
  }, [point]);

  // Mirror the state into the URL (debounced) once hydration is done.
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      const params = new URLSearchParams();
      if (address) params.set("adres", address);
      if (point) {
        params.set("lat", point.lat.toFixed(6));
        params.set("lng", point.lng.toFixed(6));
      }
      params.set("miejsca", String(spots));
      if (rateGr) params.set("stawka", String(Math.round(rateGr / 100)));
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 500);
    return () => clearTimeout(id);
  }, [ready, address, point, spots, rateGr, pathname, router]);

  function pickPoint(next: Point, label?: string) {
    setPoint(next);
    setRateGr(null); // new zone → pick up the new suggested rate
    if (label !== undefined) setAddress(label);
  }

  // One source of truth for the money, shared by the ticket and the wizard's
  // recap — two components computing the same estimate is how they drift apart.
  const effectiveRateGr = rateGr ?? reach?.rate?.midGr ?? 0;
  const commissionPct = commissionPctFor(ownerKind);
  const revenue = revenueEstimate({
    rateGr: effectiveRateGr,
    spots,
    events: reach?.events.total ?? 0,
    commissionPct,
  });

  return (
    <section id="kalkulator" className="border-b border-line bg-bg">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20 lg:px-6">
        <SectionHead
          label="Kalkulator"
          title="Policz swój zarobek"
          lead="Wpisz adres obiektu — policzymy dojście do Enea Stadionu i MTP, liczbę wydarzeń w zasięgu i szacowany roczny przychód."
        />

        <div className="mt-12 grid gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="flex flex-col gap-4 lg:col-span-5">
            <div>
              <span className="mb-1.5 block text-ui font-semibold text-ink">Adres obiektu</span>
              <AddressField
                value={address}
                onChange={setAddress}
                onPick={(item: GeocodeItem) => pickPoint({ lat: item.lat, lng: item.lng }, item.label)}
              />
              <p className="mt-1.5 text-ui text-muted">Albo kliknij miejsce na mapie.</p>
            </div>
            {reach ? <ReachSummary reach={reach} /> : null}
            {reachError ? (
              <p role="alert" className="text-ui text-danger">
                {reachError}
              </p>
            ) : null}
            {!reach && !reachError ? (
              <p className="text-body text-muted">
                {reachLoading
                  ? "Liczymy…"
                  : "Wskaż miejsce, żeby zobaczyć potencjał i szacowany zarobek."}
              </p>
            ) : null}
          </div>

          <div className="lg:col-span-7">
            <ReachMap
              point={point}
              rings={reach?.rings ?? []}
              venues={reach?.venues ?? []}
              onPointPick={(next) => pickPoint(next, "Wskazany punkt na mapie")}
            />
          </div>
        </div>

        {point && reach ? (
          <div className="mt-12 border-t border-line pt-12">
            <RevenuePanel
              reach={reach}
              spots={spots}
              onSpotsChange={setSpots}
              ownerKind={ownerKind}
              onOwnerKindChange={setOwnerKind}
              rateGr={effectiveRateGr}
              onRateChange={setRateGr}
              commissionPct={commissionPct}
              revenue={revenue}
              onOpenLead={() => setLeadOpen(true)}
            />
          </div>
        ) : null}

        <LeadWizard
          open={leadOpen}
          onClose={() => setLeadOpen(false)}
          address={address}
          point={point}
          spots={spots}
          ownerKind={ownerKind}
          rateGr={effectiveRateGr}
          annualNetGr={revenue.annualNetGr}
        />
      </div>
    </section>
  );
}

function ReachSummary({ reach }: { reach: ReachData }) {
  const enea = reach.venues.find((v) => v.key === "ENEA");
  const mtp = reach.venues.find((v) => v.key === "MTP");
  return (
    <div className="rounded-card border border-line bg-surface p-4" aria-live="polite">
      <dl className="grid grid-cols-2 gap-4">
        {enea ? <Walk term="Enea Stadion" minutes={enea.walkMinutes} /> : null}
        {mtp ? <Walk term="MTP" minutes={mtp.walkMinutes} /> : null}
      </dl>
      <p className="mt-4 border-t border-line pt-3 text-ui text-muted">
        Dojście w linii prostej (z narzutem na trasę). W zasięgu 15 min:{" "}
        <span className="font-semibold tabular-nums text-ink">{reach.events.total}</span> wydarzeń —
        mecze {reach.events.football}, targi {reach.events.tradeFair}, inne {reach.events.other}.
      </p>
    </div>
  );
}

function Walk({ term, minutes }: { term: string; minutes: number }) {
  return (
    <div>
      <dt className="text-ui text-muted">{term}</dt>
      <dd className="mt-0.5 flex items-baseline gap-1.5">
        <span className="text-ui text-muted">ok.</span>
        <span className="font-display text-h3 font-extrabold tabular-nums text-ink">{minutes}</span>
        <span className="text-ui text-muted">min pieszo</span>
      </dd>
    </div>
  );
}
