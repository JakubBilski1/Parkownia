import { and, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { events, venues } from "@/db/schema";
import { SectionHead } from "./section-head";

/**
 * Real numbers only. The event count is a live query over our own events table;
 * the stadium capacity is the venue's own datum. Attendance/footfall we do NOT
 * have, so it stays an explicit TODO placeholder — never a fabricated figure
 * (DESIGN_PRINCIPLES §1: no fake numbers before they are real).
 */
type ScaleStats = { eventsNext12mo: number | null; eneaCapacity: number | null };

async function getStats(): Promise<ScaleStats> {
  // This is an acquisition page — a database hiccup must not 500 it. On failure
  // the section still renders, just without the live figures.
  try {
    const [eventRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(events)
      .where(
        and(
          gte(events.endsAt, sql`now()`),
          lte(events.startsAt, sql`now() + interval '12 months'`),
        ),
      );

    const [enea] = await db
      .select({ capacity: venues.capacity })
      .from(venues)
      .where(sql`${venues.name} ILIKE ${"%enea%"}`)
      .limit(1);

    return { eventsNext12mo: eventRow?.n ?? 0, eneaCapacity: enea?.capacity ?? null };
  } catch (error) {
    console.error("[landing] scale stats failed:", error instanceof Error ? error.message : error);
    return { eventsNext12mo: null, eneaCapacity: null };
  }
}

export async function Scale() {
  const { eventsNext12mo, eneaCapacity } = await getStats();
  const hasFigures = eneaCapacity !== null || eventsNext12mo !== null;

  return (
    <section className="border-b border-line bg-surface-2">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20 lg:px-6">
        <SectionHead
          label="Skala"
          title="Skala jest realna"
          lead="W dzień meczu albo targów pod stadion i na MTP ściągają tłumy — a miejsc do zaparkowania brakuje. To jest luka, którą wypełniasz."
        />

        {/* Two columns, not three: the grid holds exactly what we can source.
            With nothing to source (a database hiccup) the whole block is left
            out — an empty bordered box reads as a section that failed to load.
            Conditional rendering, not [hidden]: a `grid` utility outranks
            Preflight's `[hidden]{display:none}` and the box would stay visible. */}
        {hasFigures ? (
        <dl className="mt-12 grid border-t border-line sm:grid-cols-2">
          {eneaCapacity ? (
            <div className="border-b border-line py-6 sm:border-r sm:pr-8">
              <dt className="text-ui font-semibold uppercase tracking-[0.12em] text-muted">
                Pojemność Enea Stadionu
              </dt>
              <dd className="mt-3 font-display text-[clamp(2.5rem,7vw,4rem)] font-extrabold leading-none tabular-nums tracking-[-0.03em] text-ink">
                {eneaCapacity.toLocaleString("pl-PL")}
              </dd>
              <dd className="mt-2 text-body text-muted">kibiców na komplecie</dd>
            </div>
          ) : null}

          {eventsNext12mo !== null ? (
            <div className="border-b border-line py-6 sm:pl-8">
              <dt className="text-ui font-semibold uppercase tracking-[0.12em] text-muted">
                Wydarzenia w najbliższych 12 miesiącach
              </dt>
              <dd className="mt-3 font-display text-[clamp(2.5rem,7vw,4rem)] font-extrabold leading-none tabular-nums tracking-[-0.03em] text-ink">
                {eventsNext12mo.toLocaleString("pl-PL")}
              </dd>
              <dd className="mt-2 text-body text-muted">mecze Lecha i targi MTP w naszej bazie</dd>
            </div>
          ) : null}

          {/* TODO(dane): średnia frekwencja Lecha + footfall MTP. Trzeci kafelek wraca tu
              DOPIERO z realną, CYTOWANĄ liczbą (raporty klubu/Ekstraklasy, raport roczny
              Grupy MTP) — nie zgadywać. Do tego czasu go NIE MA: pusta ramka z napisem
              „do uzupełnienia” stała na stronie, którą wysyłamy obcym ludziom, i czytała się
              jako niedokończony produkt. Brak kafelka jest lepszy niż widoczny brak. */}
        </dl>
        ) : null}

        <p className="mt-6 max-w-2xl text-ui text-muted">
          {hasFigures
            ? "Liczba wydarzeń pochodzi z naszej bazy, pojemność stadionu to dane obiektu. Nie podajemy liczb, których nie możemy wskazać źródłem."
            : "Nie podajemy liczb, których nie możemy wskazać źródłem — a te akurat pochodzą z naszej bazy i chwilowo do niej nie sięgamy."}
        </p>
      </div>
    </section>
  );
}
