"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AddressField } from "./address-field";
import { LeadForm } from "./lead-form";
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

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div>
              <span className="mb-1 block text-ui font-semibold text-ink">Adres obiektu</span>
              <AddressField
                value={address}
                onChange={setAddress}
                onPick={(item: GeocodeItem) => pickPoint({ lat: item.lat, lng: item.lng }, item.label)}
              />
              <p className="mt-1 text-ui text-muted">Albo kliknij miejsce na mapie.</p>
            </div>
            {reach ? <ReachSummary reach={reach} /> : null}
            {reachError ? (
              <p role="alert" className="text-ui text-danger">
                {reachError}
              </p>
            ) : null}
          </div>

          <ReachMap
            point={point}
            rings={reach?.rings ?? []}
            venues={reach?.venues ?? []}
            onPointPick={(next) => pickPoint(next, "Wskazany punkt na mapie")}
          />
        </div>

        {point && reach ? (
          <div className="mt-10 border-t border-line pt-10">
            <RevenuePanel
              reach={reach}
              spots={spots}
              onSpotsChange={setSpots}
              ownerKind={ownerKind}
              onOwnerKindChange={setOwnerKind}
              rateGr={rateGr}
              onRateChange={setRateGr}
            />
            <div className="mt-10 max-w-2xl">
              <LeadForm address={address} point={point} spots={spots} ownerKind={ownerKind} />
            </div>
          </div>
        ) : (
          <p className="mt-6 text-body text-muted">
            {reachLoading ? "Liczymy…" : "Wskaż miejsce, żeby zobaczyć potencjał i szacowany zarobek."}
          </p>
        )}
      </div>
    </section>
  );
}

function ReachSummary({ reach }: { reach: ReachData }) {
  const enea = reach.venues.find((v) => v.key === "ENEA");
  const mtp = reach.venues.find((v) => v.key === "MTP");
  return (
    <div className="rounded-card border border-line bg-surface p-4" aria-live="polite">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-body">
        {enea ? (
          <span className="text-ink">
            Enea Stadion:{" "}
            <span className="font-semibold tabular-nums">ok. {enea.walkMinutes} min</span>
          </span>
        ) : null}
        {mtp ? (
          <span className="text-ink">
            MTP: <span className="font-semibold tabular-nums">ok. {mtp.walkMinutes} min</span>
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-ui text-muted">
        Dojście w linii prostej (z narzutem na trasę). W zasięgu 15 min:{" "}
        <span className="font-semibold tabular-nums text-ink">{reach.events.total}</span> wydarzeń —
        mecze {reach.events.football}, targi {reach.events.tradeFair}, inne {reach.events.other}.
      </p>
    </div>
  );
}
