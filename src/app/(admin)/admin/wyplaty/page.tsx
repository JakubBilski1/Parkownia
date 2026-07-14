import { addDays, startOfWeek, subWeeks } from "date-fns";
import { Banknote, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Price } from "@/components/ui/price";
import { formatDateTimePL } from "@/lib/format";
import { PAYOUT_STATUS_LABEL } from "@/modules/admin/labels";
import { getPayoutReport } from "@/modules/admin/payouts";
import { getAdminSession } from "@/modules/admin/session";
import { AccessDenied } from "../_components/access-denied";
import { FilterLink, PageHeader, Section, TableScroll, Td, Th } from "../_components/layout-parts";
import { GeneratePayoutsForm, MarkPaidDialog } from "../_components/payout-actions";

type SearchParams = Promise<{ status?: string }>;

const TABS = [
  { status: "PENDING", label: "Do wypłaty" },
  { status: "PAID", label: "Wypłacone" },
  { status: "FAILED", label: "Nieudane" },
] as const;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Last full Monday–Sunday: the week you settle is the one that has ended. */
function lastFullWeek() {
  const monday = subWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1);
  return { start: isoDate(monday), end: isoDate(addDays(monday, 6)) };
}

export default async function PayoutsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getAdminSession();
  if (!session) return <AccessDenied />;

  const params = await searchParams;
  const status = TABS.find((tab) => tab.status === params.status)?.status ?? "PENDING";

  const report = await getPayoutReport({ status });
  const week = lastFullWeek();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Wypłaty"
        description="Kto ile dostaje. Kwota hosta to jego część ceny minus jego część zwrotów."
      />

      {status === "PENDING" ? (
        <Section
          title="Nierozliczone rezerwacje"
          hint="Skończone i opłacone, jeszcze nie na żadnej wypłacie. To jest lista, z której robisz przelewy."
        >
          {report.unsettled.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Wszystko rozliczone"
              description="Żadna zakończona rezerwacja nie czeka na wypłatę. Kolejne pojawią się tu po następnym wydarzeniu."
            />
          ) : (
            <>
              <TableScroll>
                <thead>
                  <tr>
                    <Th>Host</Th>
                    <Th className="text-right">Rezerwacje</Th>
                    <Th>Konto do przelewu</Th>
                    <Th className="text-right">Do wypłaty</Th>
                  </tr>
                </thead>
                <tbody>
                  {report.unsettled.map((host) => (
                    <tr key={host.hostId}>
                      <Td className="text-ink">
                        <span className="font-semibold">{host.hostName ?? "Bez nazwiska"}</span>
                        <br />
                        <span className="text-ui text-muted">{host.hostEmail}</span>
                      </Td>
                      <Td className="num text-right">{host.bookingCount}</Td>
                      <Td className="num font-mono text-ui text-muted">
                        {host.bankAccounts.length > 0
                          ? host.bankAccounts.join(", ")
                          : "brak numeru konta"}
                      </Td>
                      <Td className="text-right">
                        <Price gr={host.amountGr} size="sm" />
                      </Td>
                    </tr>
                  ))}
                  <tr>
                    <Td className="font-semibold text-ink">Razem</Td>
                    <Td />
                    <Td />
                    <Td className="text-right">
                      <Price gr={report.unsettledTotalGr} size="md" />
                    </Td>
                  </tr>
                </tbody>
              </TableScroll>

              <GeneratePayoutsForm defaultStart={week.start} defaultEnd={week.end} />
            </>
          )}
        </Section>
      ) : null}

      <Section title="Wypłaty">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <FilterLink
              key={tab.status}
              href={`/admin/wyplaty?status=${tab.status}`}
              active={tab.status === status}
            >
              {tab.label}
            </FilterLink>
          ))}
        </div>

        {report.payouts.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="Nie ma tu żadnej wypłaty"
            description={
              status === "PENDING"
                ? "Nic nie czeka na przelew. Utwórz wypłaty za zamknięty okres, jeśli lista nierozliczonych rezerwacji nie jest pusta."
                : "Zmień filtr, żeby zobaczyć wypłaty w innym statusie."
            }
          />
        ) : (
          <TableScroll>
            <thead>
              <tr>
                <Th>Host</Th>
                <Th>Okres</Th>
                <Th className="text-right">Rezerwacje</Th>
                <Th className="text-right">Kwota</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {report.payouts.map((payout) => (
                <tr key={payout.id}>
                  <Td className="text-ink">
                    <span className="font-semibold">{payout.hostName ?? "Bez nazwiska"}</span>
                    <br />
                    <span className="text-ui text-muted">{payout.hostEmail}</span>
                  </Td>
                  <Td className="num whitespace-nowrap text-muted">
                    {payout.periodStart} – {payout.periodEnd}
                  </Td>
                  <Td className="num text-right">{payout.itemCount}</Td>
                  <Td className="text-right">
                    <Price gr={payout.amountGr} size="sm" />
                  </Td>
                  <Td>
                    <Badge
                      icon={payout.status === "PAID" ? CheckCircle2 : Clock}
                      tone={payout.status === "PAID" ? "ok" : "neutral"}
                    >
                      {PAYOUT_STATUS_LABEL[payout.status]}
                    </Badge>
                    {payout.paidAt ? (
                      <div className="num mt-1 text-ui text-muted">
                        {formatDateTimePL(payout.paidAt)}
                      </div>
                    ) : null}
                    {payout.providerRef ? (
                      <div className="mt-1 font-mono text-ui text-muted">{payout.providerRef}</div>
                    ) : null}
                  </Td>
                  <Td className="text-right">
                    {payout.status === "PENDING" ? (
                      <MarkPaidDialog
                        payoutId={payout.id}
                        hostLabel={payout.hostName ?? payout.hostEmail}
                        amountGr={payout.amountGr}
                      />
                    ) : (
                      <span className="text-ui text-muted">—</span>
                    )}
                  </Td>
                </tr>
              ))}
              <tr>
                <Td className="font-semibold text-ink">Razem</Td>
                <Td />
                <Td />
                <Td className="text-right">
                  <Price gr={report.payoutsTotalGr} size="md" />
                </Td>
                <Td />
                <Td />
              </tr>
            </tbody>
          </TableScroll>
        )}
      </Section>
    </div>
  );
}
