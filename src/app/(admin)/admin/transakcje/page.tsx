import { Ban, CheckCircle2, Clock, CircleSlash, RotateCcw, Ticket } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Price } from "@/components/ui/price";
import { Select } from "@/components/ui/select";
import { formatDateTimePL, formatTimeRangePL } from "@/lib/format";
import { BOOKING_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/modules/admin/labels";
import { getAdminSession } from "@/modules/admin/session";
import { warsawToUtc } from "@/modules/admin/time";
import { listTransactions } from "@/modules/admin/transactions";
import { AccessDenied } from "../_components/access-denied";
import { PageHeader, TableScroll, Td, Th } from "../_components/layout-parts";
import { RefundDialog } from "../_components/refund-dialog";

type SearchParams = Promise<{
  status?: string;
  q?: string;
  from?: string;
  to?: string;
  cursor?: string;
}>;

const STATUS_ICON = {
  PENDING: Clock,
  CONFIRMED: CheckCircle2,
  USED: Ticket,
  CANCELLED: RotateCcw,
  EXPIRED: CircleSlash,
  NO_SHOW: Ban,
} as const;

const STATUS_TONE = {
  PENDING: "muted",
  CONFIRMED: "ok",
  USED: "neutral",
  CANCELLED: "bad",
  EXPIRED: "muted",
  NO_SHOW: "bad",
} as const;

export default async function TransactionsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getAdminSession();
  if (!session) return <AccessDenied />;

  const params = await searchParams;

  const { items, nextCursor } = await listTransactions({
    ...(params.status ? { status: params.status } : {}),
    ...(params.q ? { q: params.q } : {}),
    ...(warsawToUtc(params.from) ? { from: warsawToUtc(params.from) } : {}),
    ...(warsawToUtc(params.to) ? { to: warsawToUtc(params.to) } : {}),
    ...(params.cursor ? { cursor: params.cursor } : {}),
    limit: 25,
  });

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "cursor") query.set(key, value);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Transakcje"
        description="Rezerwacje i ich płatności. Zwrot to interwencja poza polityką anulowania — pieniądze wracają do kierowcy od razu."
      />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5 text-ui font-semibold text-ink">
          Kod lub e-mail
          <Input
            name="q"
            type="search"
            defaultValue={params.q ?? ""}
            placeholder="PK-7H2K-9QRS albo jan@…"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-ui font-semibold text-ink">
          Status
          <Select name="status" defaultValue={params.status ?? ""}>
            <option value="">Wszystkie</option>
            {Object.entries(BOOKING_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1.5 text-ui font-semibold text-ink">
          Od
          <Input name="from" type="date" defaultValue={params.from ?? ""} />
        </label>

        <label className="flex flex-col gap-1.5 text-ui font-semibold text-ink">
          Do
          <Input name="to" type="date" defaultValue={params.to ?? ""} />
        </label>

        <Button type="submit" variant="quiet">
          Filtruj
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="Żadna transakcja nie pasuje do filtrów"
          description="Zmień zakres dat albo wyczyść wyszukiwanie. Jeśli lista jest pusta od zawsze — nikt jeszcze nic nie kupił."
        />
      ) : (
        <TableScroll>
          <thead>
            <tr>
              <Th>Kod</Th>
              <Th>Rezerwacja</Th>
              <Th>Parking</Th>
              <Th>Kierowca</Th>
              <Th className="text-right">Cena</Th>
              <Th className="text-right">Prowizja</Th>
              <Th>Status</Th>
              <Th className="text-right">Zwrot</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const refundedGr = row.refundedGr ?? 0;
              const refundableGr = (row.paidGr ?? 0) - refundedGr;
              const canRefund =
                (row.paymentStatus === "SUCCEEDED" || row.paymentStatus === "PARTIALLY_REFUNDED") &&
                refundableGr > 0;

              return (
                <tr key={row.id}>
                  <Td className="font-mono text-ui text-ink">{row.code}</Td>

                  <Td className="whitespace-nowrap text-muted">
                    <span className="num">{formatTimeRangePL(row.startsAt, row.endsAt)}</span>
                    <br />
                    <span className="num text-ui text-muted">
                      kupiona {formatDateTimePL(row.createdAt)}
                    </span>
                  </Td>

                  <Td className="text-ink">
                    {row.parkingTitle ?? "Parking bez nazwy"}
                    {row.eventTitle ? (
                      <>
                        <br />
                        <span className="text-ui text-muted">{row.eventTitle}</span>
                      </>
                    ) : null}
                  </Td>

                  <Td className="text-muted">{row.driverEmail}</Td>

                  <Td className="text-right">
                    <Price gr={row.priceGr} size="sm" />
                  </Td>

                  <Td className="text-right">
                    <Price gr={row.commissionGr} size="sm" />
                    <br />
                    <span className="num text-ui text-muted">{row.commissionRatePct}%</span>
                  </Td>

                  <Td>
                    <div className="flex flex-col items-start gap-1">
                      <Badge icon={STATUS_ICON[row.status]} tone={STATUS_TONE[row.status]}>
                        {BOOKING_STATUS_LABEL[row.status]}
                      </Badge>
                      {row.paymentStatus ? (
                        <span className="text-ui text-muted">
                          {PAYMENT_STATUS_LABEL[row.paymentStatus]}
                        </span>
                      ) : (
                        <span className="text-ui text-muted">Bez płatności</span>
                      )}
                    </div>
                  </Td>

                  <Td className="text-right">
                    {refundedGr > 0 ? (
                      <div className="mb-1 text-ui text-muted">
                        zwrócono <Price gr={refundedGr} size="sm" />
                      </div>
                    ) : null}
                    {canRefund ? (
                      <RefundDialog
                        bookingId={row.id}
                        code={row.code}
                        refundableGr={refundableGr}
                      />
                    ) : (
                      <span className="text-ui text-muted">—</span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableScroll>
      )}

      {nextCursor ? (
        <Link
          href={`/admin/transakcje?${query.toString()}${query.size > 0 ? "&" : ""}cursor=${nextCursor}`}
          className="inline-flex min-h-touch w-fit items-center rounded-button border border-line bg-surface px-4 text-body font-semibold text-ink transition-colors duration-micro ease-out hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Następne 25
        </Link>
      ) : null}
    </div>
  );
}
