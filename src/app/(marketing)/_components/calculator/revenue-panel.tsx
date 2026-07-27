"use client";

import { NumberField } from "@/components/ui";
import { Ticket, TicketMain, TicketStub } from "@/components/ui";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoneyParts, formatSpots } from "@/lib/format";
import type { RevenueEstimate } from "@/modules/leads/calc";
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
  commissionPct,
  revenue,
  onOpenLead,
}: {
  reach: ReachData;
  spots: number;
  onSpotsChange: (n: number) => void;
  ownerKind: OwnerKind;
  onOwnerKindChange: (k: OwnerKind) => void;
  rateGr: number;
  onRateChange: (gr: number) => void;
  commissionPct: number;
  revenue: RevenueEstimate;
  onOpenLead: () => void;
}) {
  const events = reach.events.total;

  // Animate on the user's own input — cause→effect feedback, snaps under
  // prefers-reduced-motion (see useCountUp).
  const netto = useCountUp(revenue.annualNetGr);
  const perEvent = useCountUp(revenue.perEventGrossGr);
  const amount = formatMoneyParts(netto);

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
      <div className="flex flex-col gap-7 lg:col-span-6">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label htmlFor="calc-spots" className="text-ui font-semibold text-ink">
              Liczba miejsc
            </label>
            <NumberField
              value={spots}
              onValueChange={onSpotsChange}
              min={1}
              max={100}
              step={1}
              steppers
              aria-label="Liczba miejsc"
            />
          </div>
          {/* The slider is for exploring, the field is for knowing. Both drive the
              same number; neither is the only way in. */}
          <input
            id="calc-spots"
            type="range"
            min={1}
            max={100}
            value={spots}
            onChange={(event) => onSpotsChange(Number(event.target.value))}
            aria-valuetext={formatSpots(spots)}
            // Ink, not accent: a control is not a call to action (§4).
            style={{ accentColor: "var(--selected-bg)" }}
            className="mt-4 w-full"
          />
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-ui font-semibold text-ink">
              Stawka za wydarzenie (za 1 miejsce)
            </span>
            <NumberField
              value={Math.round(rateGr / 100)}
              onValueChange={(zl) => onRateChange(zl * 100)}
              min={0}
              max={999}
              step={5}
              steppers
              suffix="zł"
              aria-label="Stawka za wydarzenie za jedno miejsce, w złotych"
            />
          </div>
          {reach.rate ? (
            <p className="mt-2 text-ui text-muted">
              W tej odległości od bramy sugerujemy{" "}
              <span className="tabular-nums text-ink">
                {Math.round(reach.rate.minGr / 100)}–{Math.round(reach.rate.maxGr / 100)} zł
              </span>
              .
            </p>
          ) : null}
        </div>

        <div>
          <span className="block text-ui font-semibold text-ink">Rozliczasz jako</span>
          <div className="mt-2 inline-flex rounded-button border border-line p-0.5">
            {(["INDIVIDUAL", "BUSINESS"] as OwnerKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => onOwnerKindChange(kind)}
                aria-pressed={ownerKind === kind}
                className={cn(
                  "min-h-touch rounded-[calc(var(--radius-button)-2px)] px-4 text-ui font-semibold transition-colors duration-micro ease-out",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
                  ownerKind === kind ? "bg-selected text-selected-ink" : "text-muted hover-hover:hover:text-ink",
                )}
              >
                {kind === "INDIVIDUAL" ? "Osoba prywatna" : "Firma"}
              </button>
            ))}
          </div>
          <p className="mt-2 text-ui text-muted">Prowizja Parkowni: {commissionPct}%.</p>
        </div>
      </div>

      {/* The kwit. The estimate is not a card — it is the object the whole page
          is about, torn along the same perforation as a real booking
          (DESIGN_SYSTEM §4). Mono digits, body currency; the accent stays on the
          CTA in the stub. */}
      <div className="lg:col-span-6">
        <Ticket>
          <TicketMain className="p-5 sm:p-6">
            <p className="text-ui font-semibold uppercase tracking-[0.12em] text-muted">
              Szacunek roczny
            </p>
            <p className="mt-3 flex items-baseline gap-2" aria-live="polite">
              <span className="num font-mono text-[clamp(2.25rem,7vw,3.25rem)] font-semibold leading-none tracking-[-0.02em] text-ink">
                {amount.amount}
              </span>
              <span className="text-lead text-muted">{amount.currency}</span>
            </p>

            <dl className="mt-6 border-t border-line text-body">
              <Row term="Przychód na wydarzenie" gr={perEvent} />
              <Row term="Rocznie brutto" gr={revenue.annualGrossGr} />
              <Row
                term={`Prowizja Parkowni (${commissionPct}%)`}
                gr={revenue.commissionGr}
                sign="−"
              />
            </dl>
          </TicketMain>

          <TicketStub className="p-5 sm:p-6">
            <p className="text-ui text-muted">
              {events > 0
                ? `Przy ${events} wydarzeniach w zasięgu i pełnym obłożeniu. To szacunek, nie gwarancja.`
                : "W zasięgu 15 minut nie ma jeszcze wydarzeń z naszej bazy — wskaż miejsce bliżej Enei lub MTP, żeby zobaczyć szacunek."}
            </p>
            <Button variant="accent" size="lg" block className="mt-4" onClick={onOpenLead}>
              Porozmawiajmy o moim miejscu
            </Button>
            <p className="mt-3 text-center text-ui text-muted">
              Trzy krótkie pytania. To nie jest zobowiązanie.
            </p>
          </TicketStub>
        </Ticket>
      </div>
    </div>
  );
}

/**
 * Digits in mono, "zł" in body — DESIGN_SYSTEM §2. Setting the whole string in
 * monospace makes the currency read as a typo, which is exactly how it looked
 * when this shipped as one <dd>.
 */
function Row({ term, gr, sign }: { term: string; gr: number; sign?: string }) {
  const { amount, currency } = formatMoneyParts(gr);
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-b-0">
      <dt className="text-muted">{term}</dt>
      <dd className="flex items-baseline gap-1">
        <span className="num font-mono text-ink">
          {sign}
          {amount}
        </span>
        <span className="text-muted">{currency}</span>
      </dd>
    </div>
  );
}
