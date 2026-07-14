"use client";

import { Umbrella } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatMoneyParts, formatParkings } from "@/lib/format";

/**
 * The left edge carries the same perforation tooth as the ticket, so a pin
 * reads as a stub torn off it. It is a CSS mask (a real hole — the map shows
 * through), which clips box-shadow; the elevation comes from a filter instead.
 */
const NOTCH_MASK =
  "radial-gradient(circle 5px at 0 50%, transparent 5px, #000 5.5px)";

export type PricePinProps = {
  priceGr: number;
  /** Straight-line estimate, already hedged in copy. Hidden when unknown. */
  walkMinutes?: number | null;
  isCovered?: boolean | null;
  selected?: boolean;
  /** Height of the stem raising the label clear of an overlapping neighbour. */
  liftPx?: number;
  onSelect: () => void;
};

export function PricePin({
  priceGr,
  walkMinutes,
  isCovered,
  selected = false,
  liftPx = 0,
  onSelect,
}: PricePinProps) {
  const { amount, currency } = formatMoneyParts(priceGr);

  const description = [
    `${amount} ${currency}`,
    typeof walkMinutes === "number" ? `ok. ${walkMinutes} min pieszo` : null,
    isCovered ? "zadaszony" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      aria-pressed={selected}
      aria-label={description}
      className={cn(
        "press flex min-w-[60px] flex-col items-center drop-shadow-ticket",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
      )}
    >
      <span
        style={{ WebkitMaskImage: NOTCH_MASK, maskImage: NOTCH_MASK }}
        className={cn(
          "flex min-h-touch w-full flex-col justify-center gap-1 rounded-chip border py-1 pl-2.5 pr-2",
          "transition-colors duration-micro ease-out",
          selected
            ? "border-accent bg-accent text-accent-ink"
            : "border-line bg-surface text-ink",
        )}
      >
        <span className="num flex items-baseline gap-0.5 font-mono text-ui font-semibold leading-none">
          <span>{amount}</span>
          <span className="font-body text-ui font-normal opacity-80">{currency}</span>
        </span>
        {/* No reference point, no claim: a pin that cannot measure the walk says
            nothing about it rather than printing a placeholder. */}
        {typeof walkMinutes === "number" || isCovered ? (
          <span
            className={cn(
              "flex items-center gap-1 text-ui leading-none",
              selected ? "opacity-90" : "text-muted",
            )}
          >
            {typeof walkMinutes === "number" ? (
              <span className="num">{walkMinutes} min</span>
            ) : null}
            {isCovered ? <Umbrella size={14} aria-hidden="true" /> : null}
          </span>
        ) : null}
      </span>

      {liftPx > 0 ? (
        <span
          aria-hidden="true"
          style={{ height: `${liftPx}px` }}
          className={cn("w-px", selected ? "bg-accent" : "bg-line")}
        />
      ) : null}

      <span
        aria-hidden="true"
        className={cn(
          "-mt-[3px] h-[7px] w-[7px] rotate-45 border-b border-r",
          selected ? "border-accent bg-accent" : "border-line bg-surface",
        )}
      />
    </button>
  );
}

export type ClusterBubbleProps = {
  count: number;
  /** Cheapest pin inside the cluster — the number a driver actually decides on. */
  fromPriceGr: number | null;
  onSelect: () => void;
};

/**
 * Clusters are never the accent: they are not a choice yet, only a place with
 * choices in it. Neutral surface, count in tabular mono.
 */
export function ClusterBubble({ count, fromPriceGr, onSelect }: ClusterBubbleProps) {
  const price = fromPriceGr === null ? null : formatMoneyParts(fromPriceGr);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      aria-label={
        price
          ? `${formatParkings(count)}, od ${price.amount} ${price.currency}. Przybliż, żeby zobaczyć.`
          : `${formatParkings(count)}. Przybliż, żeby zobaczyć.`
      }
      className={cn(
        "press flex min-h-touch min-w-touch flex-col items-center justify-center rounded-pill border border-line bg-surface px-2 shadow-card",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
      )}
    >
      <span className="num font-mono text-ui font-semibold leading-none text-ink">
        {count}
      </span>
      {price ? (
        <span className="num mt-1 font-mono text-ui leading-none text-muted">
          od {price.amount}
          <span className="font-body"> {price.currency}</span>
        </span>
      ) : null}
    </button>
  );
}
