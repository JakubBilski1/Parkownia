import { CheckCircle2, CircleSlash, Handshake, Mail, Phone, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Price } from "@/components/ui/price";
import { Select } from "@/components/ui/select";
import { formatDateTimePL, formatSpots } from "@/lib/format";
import {
  LEAD_CONTACT_PREFERENCE_LABEL,
  LEAD_OBJECT_TYPE_LABEL,
  LEAD_STATUS_LABEL,
} from "@/modules/admin/labels";
import { listLeads } from "@/modules/admin/leads";
import { getAdminSession } from "@/modules/admin/session";
import { AccessDenied } from "../_components/access-denied";
import { LeadActions } from "../_components/lead-actions";
import { PageHeader, TableScroll, Td, Th } from "../_components/layout-parts";

type SearchParams = Promise<{ status?: string; q?: string; cursor?: string }>;

const STATUS_ICON = {
  NEW: Sparkles,
  CONTACTED: Phone,
  QUALIFIED: Handshake,
  CONVERTED: CheckCircle2,
  REJECTED: CircleSlash,
  SPAM: Trash2,
} as const;

const STATUS_TONE = {
  NEW: "ok",
  CONTACTED: "neutral",
  QUALIFIED: "neutral",
  CONVERTED: "ok",
  REJECTED: "muted",
  SPAM: "bad",
} as const;

export default async function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getAdminSession();
  if (!session) return <AccessDenied />;

  const params = await searchParams;

  const { items, nextCursor } = await listLeads({
    ...(params.status ? { status: params.status } : {}),
    ...(params.q ? { q: params.q } : {}),
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
        title="Leady"
        description="Właściciele, którzy zostawili kontakt na /dla-wlascicieli. Każdy z nich policzył sobie zarobek i kliknął „porozmawiajmy” — dzwoń, dopóki to pamięta."
      />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5 text-ui font-semibold text-ink">
          Imię, adres, telefon lub e-mail
          <Input
            name="q"
            type="search"
            defaultValue={params.q ?? ""}
            placeholder="Grunwaldzka albo 600100200"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-ui font-semibold text-ink">
          Status
          <Select name="status" defaultValue={params.status ?? ""}>
            <option value="">Wszystkie</option>
            {Object.entries(LEAD_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>

        <Button type="submit" variant="quiet">
          Filtruj
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="Żaden lead nie pasuje do filtrów"
          description="Wyczyść wyszukiwanie. Jeśli lista jest pusta od zawsze — nikt jeszcze nie wysłał formularza z /dla-wlascicieli."
        />
      ) : (
        <TableScroll>
          <thead>
            <tr>
              <Th>Kiedy</Th>
              <Th>Kontakt</Th>
              <Th>Obiekt</Th>
              <Th>Dojście</Th>
              <Th className="text-right">Szacunek roczny</Th>
              <Th>Zgody</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((lead) => (
              <tr key={lead.id}>
                <Td className="whitespace-nowrap text-muted">
                  <span className="num">{formatDateTimePL(lead.createdAt)}</span>
                  {lead.source ? (
                    <>
                      <br />
                      <span className="text-ui text-muted">{lead.source}</span>
                    </>
                  ) : null}
                </Td>

                <Td>
                  <span className="font-semibold text-ink">{lead.contactName}</span>
                  <br />
                  {lead.phone ? (
                    <a
                      href={`tel:${lead.phone.replace(/\s/g, "")}`}
                      className="num text-ink underline underline-offset-4"
                    >
                      {lead.phone}
                    </a>
                  ) : null}
                  {lead.phone && lead.email ? <br /> : null}
                  {lead.email ? (
                    <a href={`mailto:${lead.email}`} className="text-ink underline underline-offset-4">
                      {lead.email}
                    </a>
                  ) : null}
                  <br />
                  <span className="text-ui text-muted">
                    {LEAD_CONTACT_PREFERENCE_LABEL[lead.contactPreference]}
                  </span>
                </Td>

                <Td>
                  <span className="text-ink">{lead.objectName ?? lead.address}</span>
                  {lead.objectName ? (
                    <>
                      <br />
                      <span className="text-ui text-muted">{lead.address}</span>
                    </>
                  ) : null}
                  <br />
                  <span className="text-ui text-muted">
                    {lead.objectType ? LEAD_OBJECT_TYPE_LABEL[lead.objectType] : "Typ niepodany"}
                    {lead.spotsDeclared ? ` · ${formatSpots(lead.spotsDeclared)}` : ""}
                  </span>
                </Td>

                <Td className="whitespace-nowrap text-muted">
                  {/* Straight-line minutes with the detour factor, never routed on foot (CLAUDE.md). */}
                  {lead.walkMinutesEnea != null ? (
                    <span className="num">ok. {lead.walkMinutesEnea} min do Enei</span>
                  ) : (
                    <span>bez współrzędnych</span>
                  )}
                  {lead.walkMinutesMtp != null ? (
                    <>
                      <br />
                      <span className="num">ok. {lead.walkMinutesMtp} min do MTP</span>
                    </>
                  ) : null}
                  {lead.eventsInReach != null ? (
                    <>
                      <br />
                      <span className="num text-ui text-muted">
                        {lead.eventsInReach} wydarzeń w zasięgu
                      </span>
                    </>
                  ) : null}
                </Td>

                <Td className="text-right">
                  {lead.estimatedAnnualGrossGr != null ? (
                    <Price gr={lead.estimatedAnnualGrossGr} size="sm" />
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                  {lead.estimatedRateGr != null ? (
                    <>
                      <br />
                      <span className="num text-ui text-muted">
                        stawka {Math.round(lead.estimatedRateGr / 100)} zł/miejsce
                      </span>
                    </>
                  ) : null}
                </Td>

                <Td>
                  <div className="flex flex-col items-start gap-1">
                    <Badge icon={Mail} tone={lead.marketingEmailConsent ? "ok" : "muted"}>
                      {lead.marketingEmailConsent ? "Mail: tak" : "Mail: nie"}
                    </Badge>
                    <Badge icon={Phone} tone={lead.marketingPhoneConsent ? "ok" : "muted"}>
                      {lead.marketingPhoneConsent ? "Telefon: tak" : "Telefon: nie"}
                    </Badge>
                  </div>
                </Td>

                <Td>
                  <div className="flex flex-col items-start gap-2">
                    <Badge icon={STATUS_ICON[lead.status]} tone={STATUS_TONE[lead.status]}>
                      {LEAD_STATUS_LABEL[lead.status]}
                    </Badge>
                    <LeadActions leadId={lead.id} status={lead.status} />
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableScroll>
      )}

      {nextCursor ? (
        <Link
          href={`/admin/leady?${query.toString()}${query.size > 0 ? "&" : ""}cursor=${nextCursor}`}
          className="inline-flex min-h-touch w-fit items-center rounded-button border border-line bg-surface px-4 text-body font-semibold text-ink transition-colors duration-micro ease-out hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Następne 25
        </Link>
      ) : null}
    </div>
  );
}
