"use client";

import { formatMoney, formatSpots } from "@/lib/format";
import { cn } from "@/lib/cn";
import { inputBase } from "@/components/ui";
import { commissionPctFor, revenueEstimate } from "@/modules/leads/calc";
import type { OwnerKind, ReachData } from "./types";
import { useCountUp } from "./use-count-up";

export function RevenuePanel({
  reach,
  spots,
  onSpotsChange,
  ownerKind,
  onOwnerKindChange,
  rateGr,
  onRateChange,
}: {
  reach: ReachData;
  spots: number;
  onSpotsChange: (n: number) => void;
  ownerKind: OwnerKind;
  onOwnerKindChange: (k: OwnerKind) => void;
  rateGr: number | null;
  onRateChange: (gr: number) => void;
}) {
  const events = reach.events.total;
  const pct = commissionPctFor(ownerKind);
  const effectiveRateGr = rateGr ?? reach.rate?.midGr ?? 0;
  const rev = revenueEstimate({ rateGr: effectiveRateGr, spots, events, commissionPct: pct });

  // Animate on the user's own input — cause→effect feedback, snaps under
  // prefers-reduced-motion (see useCountUp).
  const netto = useCountUp(rev.annualNetGr);
  const perEvent = useCountUp(rev.perEventGrossGr);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-5">
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="calc-spots" className="text-ui font-semibold text-ink">
              Liczba miejsc
            </label>
            <span className="font-display text-h3 font-extrabold tabular-nums text-ink">{spots}</span>
          </div>
          <input
            id="calc-spots"
            type="range"
            min={1}
            max={100}
            value={spots}
            onChange={(event) => onSpotsChange(Number(event.target.value))}
            aria-valuetext={formatSpots(spots)}
            style={{ accentColor: "var(--accent)" }}
            className="mt-3 w-full"
          />
        </div>

        <div>
          <label htmlFor="calc-rate" className="text-ui font-semibold text-ink">
            Stawka za wydarzenie (za 1 miejsce)
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              id="calc-rate"
              type="number"
              min={0}
              step={5}
              value={Math.round(effectiveRateGr / 100)}
              onChange={(event) =>
                onRateChange(Math.max(0, Math.round(Number(event.target.value) || 0)) * 100)
              }
              className={cn(inputBase, "w-24 tabular-nums")}
            />
            <span className="text-body text-muted">zł</span>
            {reach.rate ? (
              <span className="text-ui text-muted">
                sugerowane {Math.round(reach.rate.minGr / 100)}–{Math.round(reach.rate.maxGr / 100)} zł
              </span>
            ) : null}
          </div>
        </div>

        <div>
          <span className="text-ui font-semibold text-ink">Rozliczasz jako</span>
          <div className="mt-2 inline-flex rounded-button border border-line p-0.5">
            {(["INDIVIDUAL", "BUSINESS"] as OwnerKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => onOwnerKindChange(kind)}
                aria-pressed={ownerKind === kind}
                className={cn(
                  "min-h-touch rounded-[calc(var(--radius-button)-2px)] px-3 text-ui font-semibold transition-colors duration-micro ease-out",
                  ownerKind === kind ? "bg-selected text-selected-ink" : "text-muted hover:text-ink",
                )}
              >
                {kind === "INDIVIDUAL" ? "Osoba prywatna" : "Firma"}
              </button>
            ))}
          </div>
          <p className="mt-1 text-ui text-muted">Prowizja Parkowni: {pct}%.</p>
        </div>
      </div>

      {/* The "kwit" — the signature payoff. Big number in ink (the accent stays on
          the CTA, §4); mono tabular-nums keeps the money world of "Bilet". */}
      <div className="rounded-card border border-line bg-surface p-6" aria-live="polite">
        <p className="text-ui text-muted">Twój szacowany zarobek rocznie</p>
        <p className="mt-1 font-display text-[clamp(2rem,6vw,2.75rem)] font-extrabold leading-none tracking-tight text-ink [font-variant-numeric:tabular-nums]">
          {formatMoney(netto)}
        </p>

        <dl className="mt-5 space-y-2 text-body">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted">Przychód na wydarzenie</dt>
            <dd className="tabular-nums text-ink">{formatMoney(perEvent)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted">Rocznie brutto</dt>
            <dd className="tabular-nums text-ink">{formatMoney(rev.annualGrossGr)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted">Prowizja Parkowni ({pct}%)</dt>
            <dd className="tabular-nums text-ink">−{formatMoney(rev.commissionGr)}</dd>
          </div>
        </dl>

        <p className="mt-4 text-ui text-muted">
          {events > 0
            ? `Przy ${events} wydarzeniach w zasięgu i pełnym obłożeniu. To szacunek, nie gwarancja.`
            : "W zasięgu 15 minut nie ma jeszcze wydarzeń z naszej bazy — wskaż miejsce bliżej Enei lub MTP, żeby zobaczyć szacunek."}
        </p>
      </div>
    </div>
  );
}
