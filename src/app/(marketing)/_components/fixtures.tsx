import Link from "next/link";
import type { EventCategory } from "@/db/types";
import { formatEventCountdownPL, formatTimePL } from "@/lib/format";

// Presentational only — the query lives in fixtures-data.ts so that importing
// this panel from a client component cannot drag `postgres` into the bundle.

const CATEGORY_LABEL: Record<EventCategory, string> = {
  FOOTBALL: "Mecz",
  CONCERT: "Koncert",
  TRADE_FAIR: "Targi",
  SPORTS: "Sport",
  FESTIVAL: "Festiwal",
  OTHER: "Wydarzenie",
};

export type FixtureRow = {
  id: string;
  title: string;
  venue: string;
  category: EventCategory;
  startsAt: Date;
  endsAt: Date;
};

export type FixturesData = { rows: FixtureRow[]; rest: number };

/**
 * The one live thing on the page: our own events table as a matchday fixture
 * list. It earns its place three ways — it is real (no invented figures), it
 * dates itself (an owner sees the next match is nine days out, not "soon"), and
 * it is the argument the copy is making, in evidence form.
 */
export function FixturesPanel({ data }: { data: FixturesData }) {
  return (
    <div className="rounded-card border border-line bg-surface shadow-card">
      <div className="flex items-baseline justify-between gap-4 border-b border-line px-4 py-3">
        <h2 className="text-ui font-semibold uppercase tracking-[0.12em] text-muted">Terminarz</h2>
        <Link
          href="/wydarzenia"
          className="rounded-button text-ui text-ink underline underline-offset-4 hover-hover:hover:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Wszystkie
        </Link>
      </div>

      <ol className="divide-y divide-line">
        {data.rows.map((row) => (
          <li key={row.id} className="flex items-baseline gap-3 px-4 py-3">
            {/* Tabular figures, so the date column aligns down the list — the
                detail that separates a product from a prototype (§3). */}
            <time
              dateTime={row.startsAt.toISOString()}
              className="w-[3.25rem] shrink-0 text-body font-semibold tabular-nums text-ink"
            >
              {formatStamp(row.startsAt)}
            </time>
            <div className="min-w-0 flex-1">
              <p className="truncate text-body text-ink">{row.title}</p>
              <p className="truncate text-ui text-muted">
                {CATEGORY_LABEL[row.category]} · {row.venue} ·{" "}
                <span className="tabular-nums">{formatTimePL(row.startsAt)}</span>
              </p>
            </div>
            <span className="shrink-0 whitespace-nowrap text-ui tabular-nums text-muted">
              {formatEventCountdownPL(row.startsAt, row.endsAt)}
            </span>
          </li>
        ))}
      </ol>

      <p className="border-t border-line px-4 py-3 text-ui text-muted">
        {data.rest > 0 ? (
          <>
            <span className="tabular-nums text-ink">+{data.rest}</span> kolejnych w naszej bazie.
            Każde z nich to auta szukające miejsca.
          </>
        ) : (
          "Każde z nich to auta szukające miejsca."
        )}
      </p>
    </div>
  );
}

/** "25.07" — day and month only; the year is implied by "upcoming". */
function formatStamp(date: Date): string {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(date);
}
