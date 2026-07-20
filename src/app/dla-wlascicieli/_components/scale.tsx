import { and, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { events, venues } from "@/db/schema";

/**
 * Real numbers only. The event count is a live query over our own events table;
 * the stadium capacity is the venue's own datum. Attendance/footfall we do NOT
 * have, so it stays an explicit TODO placeholder — never a fabricated figure
 * (DESIGN_PRINCIPLES §1: no fake numbers before they are real).
 */
async function getStats(): Promise<{ eventsNext12mo: number; eneaCapacity: number | null }> {
  const [eventRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(events)
    .where(
      and(gte(events.endsAt, sql`now()`), lte(events.startsAt, sql`now() + interval '12 months'`)),
    );

  const [enea] = await db
    .select({ capacity: venues.capacity })
    .from(venues)
    .where(sql`${venues.name} ILIKE ${"%enea%"}`)
    .limit(1);

  return { eventsNext12mo: eventRow?.n ?? 0, eneaCapacity: enea?.capacity ?? null };
}

export async function Scale() {
  const { eventsNext12mo, eneaCapacity } = await getStats();

  return (
    <section className="border-b border-line bg-bg">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20 lg:px-6">
        <h2 className="font-display text-h1 font-extrabold tracking-tight text-ink">
          Skala jest realna
        </h2>
        <p className="mt-3 max-w-2xl text-lead text-muted">
          W dzień meczu albo targów pod stadion i na MTP ściągają tłumy — a miejsc do zaparkowania
          brakuje. To jest luka, którą wypełniasz.
        </p>

        <dl className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {eneaCapacity ? (
            <div className="rounded-card border border-line bg-surface p-6">
              <dt className="text-ui text-muted">Pojemność Enea Stadionu</dt>
              <dd className="mt-2 font-display text-h1 font-extrabold tabular-nums tracking-tight text-ink">
                {eneaCapacity.toLocaleString("pl-PL")}
              </dd>
              <dd className="mt-1 text-ui text-muted">kibiców na komplecie</dd>
            </div>
          ) : null}

          <div className="rounded-card border border-line bg-surface p-6">
            <dt className="text-ui text-muted">Wydarzenia w najbliższych 12 miesiącach</dt>
            <dd className="mt-2 font-display text-h1 font-extrabold tabular-nums tracking-tight text-ink">
              {eventsNext12mo.toLocaleString("pl-PL")}
            </dd>
            <dd className="mt-1 text-ui text-muted">mecze Lecha i targi MTP w naszej bazie</dd>
          </div>

          {/* TODO(dane): średnia frekwencja Lecha + footfall MTP — wstawić realne, CYTOWANE liczby
              przed publikacją (raporty klubu/Ekstraklasy, raport roczny Grupy MTP). Nie zgadywać. */}
          <div className="rounded-card border border-dashed border-line bg-surface p-6">
            <dt className="text-ui text-muted">Średnia frekwencja</dt>
            <dd className="mt-2 font-display text-h1 font-extrabold tracking-tight text-muted">— —</dd>
            <dd className="mt-1 text-ui text-muted">do uzupełnienia z cytowanego źródła</dd>
          </div>
        </dl>

        <p className="mt-6 text-ui text-muted">
          Liczba wydarzeń pochodzi z naszej bazy; pojemność stadionu to dane obiektu. Frekwencję
          uzupełnimy o zweryfikowane źródło przed publikacją.
        </p>
      </div>
    </section>
  );
}
