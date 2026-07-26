import {
  Banknote,
  CalendarClock,
  Inbox,
  Percent,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Price } from "@/components/ui/price";
import { formatDateTimePL } from "@/lib/format";
import { getDashboard } from "@/modules/admin/dashboard";
import { countNewLeads } from "@/modules/admin/leads";
import { getAdminSession } from "@/modules/admin/session";
import { utcToWarsawInput, warsawToUtc } from "@/modules/admin/time";
import { AccessDenied } from "./_components/access-denied";
import { Metric, PageHeader, Section, TableScroll, Td, Th } from "./_components/layout-parts";

type SearchParams = Promise<{ from?: string; to?: string }>;

/** The operator picks Warsaw days, not UTC days. */
function toInputDate(date: Date): string {
  return utcToWarsawInput(date).slice(0, 10);
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getAdminSession();
  if (!session) return <AccessDenied />;

  const { from, to } = await searchParams;

  // Deliberately outside the date filter: an untouched lead is a to-do, not a
  // statistic for a period.
  const [metrics, newLeads] = await Promise.all([
    getDashboard({ from: warsawToUtc(from), to: warsawToUtc(to) }),
    countNewLeads(),
  ]);

  const { conversion } = metrics;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Pulpit"
        description={`Dane za okres ${formatDateTimePL(metrics.period.from)} – ${formatDateTimePL(metrics.period.to)}. Każda liczba jest sumą wierszy w bazie.`}
      />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-ui font-semibold text-ink">
          Od
          <input
            type="date"
            name="from"
            defaultValue={from ?? toInputDate(metrics.period.from)}
            className="num min-h-touch rounded-button border border-line bg-surface px-3 text-body text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-ui font-semibold text-ink">
          Do
          <input
            type="date"
            name="to"
            defaultValue={to ?? toInputDate(metrics.period.to)}
            className="num min-h-touch rounded-button border border-line bg-surface px-3 text-body text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </label>
        <Button type="submit" variant="quiet">
          Pokaż okres
        </Button>
      </form>

      <Section title="Pieniądze" hint="Rezerwacje liczone po dacie zakupu, zwroty po dacie anulowania.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Metric
            label="GMV"
            icon={TrendingUp}
            value={<Price gr={metrics.gmvGr} size="lg" />}
            definition="Suma cen rezerwacji opłaconych i wykorzystanych."
          />
          <Metric
            label="Transakcje"
            icon={CalendarClock}
            value={metrics.txCount}
            definition="Liczba tych rezerwacji."
          />
          <Metric
            label="Średnia rezerwacja"
            icon={Banknote}
            value={<Price gr={metrics.avgTicketGr} size="lg" />}
            definition="GMV podzielone przez liczbę transakcji."
          />
          <Metric
            label="Prowizja"
            icon={Percent}
            value={<Price gr={metrics.commissionGr} size="lg" />}
            definition="Stawka zamrożona w chwili rezerwacji, przed zwrotami."
          />
          <Metric
            label="Prowizja po zwrotach"
            icon={Percent}
            value={<Price gr={metrics.netCommissionGr} size="lg" />}
            definition={`Prowizja minus nasza część zwrotów. Zwrócono kierowcom ${(metrics.refundedGr / 100).toFixed(2).replace(".", ",")} zł.`}
          />
          <Metric
            label="Do wypłaty hostom"
            icon={Banknote}
            value={<Price gr={metrics.outstandingPayoutGr} size="lg" />}
            definition="Wypłaty oczekujące plus rezerwacje jeszcze nierozliczone."
          />
        </div>
      </Section>

      <Section title="Podaż i konwersja">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Metric
            label="Aktywni hostowie"
            icon={Users}
            value={metrics.activeHosts}
            definition="Hostowie, którzy zarobili w tym okresie choć jedną rezerwację."
          />
          <Metric
            label="Hostowie z aktywnym parkingiem"
            icon={Users}
            value={metrics.hostsWithActiveParkings}
            definition="Stan na teraz, niezależnie od okresu."
          />
          <Metric
            label="Aktywne parkingi"
            icon={ShieldAlert}
            value={metrics.activeParkings}
            definition="Parkingi w statusie „aktywny”."
          />
          <Metric
            label="Konwersja"
            icon={Percent}
            value={conversion.ratePct === null ? "—" : `${conversion.ratePct}%`}
            definition={
              conversion.ratePct === null
                ? "W tym okresie nikt nie zaczął rezerwacji."
                : `${conversion.paidCount} opłaconych z ${conversion.startedCount} rozpoczętych rezerwacji. Nie mierzymy wejść na stronę.`
            }
          />
          <Metric
            label="Czeka na moderację"
            icon={ShieldAlert}
            value={metrics.pendingReview}
            definition="Parkingi zgłoszone przez hostów, jeszcze nierozpatrzone."
          />
          <Metric
            label="Nowe leady"
            icon={Inbox}
            value={newLeads}
            definition="Właściciele ze strony głównej, z którymi nikt jeszcze nie rozmawiał. Bez podaży to jedyna liczba, która rośnie."
          />
        </div>

        <div className="flex flex-wrap gap-3">
          {metrics.pendingReview > 0 ? (
            <Link
              href="/admin/moderacja"
              className="inline-flex min-h-touch w-fit items-center rounded-button border border-line bg-surface px-4 text-body font-semibold text-ink transition-colors duration-micro ease-out hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Przejdź do moderacji
            </Link>
          ) : null}

          {newLeads > 0 ? (
            <Link
              href="/admin/leady"
              className="inline-flex min-h-touch w-fit items-center rounded-button border border-line bg-surface px-4 text-body font-semibold text-ink transition-colors duration-micro ease-out hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Odezwij się do leadów
            </Link>
          ) : null}
        </div>
      </Section>

      <Section title="Najlepsze parkingi" hint="Po GMV w wybranym okresie.">
        {metrics.topParkings.length === 0 ? (
          <EmptyState
            title="Brak sprzedaży w tym okresie"
            description="Żadna rezerwacja nie została opłacona między wybranymi datami. Zmień zakres albo sprawdź, czy w Poznaniu wypada w tym czasie jakieś wydarzenie."
            action={
              <Link
                href="/admin/wydarzenia"
                className="inline-flex min-h-touch items-center rounded-button border border-line bg-surface px-4 text-body font-semibold text-ink transition-colors duration-micro ease-out hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                Wydarzenia
              </Link>
            }
          />
        ) : (
          <TableScroll>
            <thead>
              <tr>
                <Th>Parking</Th>
                <Th className="text-right">Transakcje</Th>
                <Th className="text-right">GMV</Th>
              </tr>
            </thead>
            <tbody>
              {metrics.topParkings.map((parking) => (
                <tr key={parking.parkingId}>
                  <Td className="font-semibold text-ink">{parking.title ?? "Parking bez nazwy"}</Td>
                  <Td className="num text-right">{parking.txCount}</Td>
                  <Td className="text-right">
                    <Price gr={parking.gmvGr} size="sm" />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableScroll>
        )}
      </Section>
    </div>
  );
}
