import { Ban, Camera, CheckCircle2, Clock, Ruler } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardFooter, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Price } from "@/components/ui/price";
import { formatDateTimePL, formatHeight } from "@/lib/format";
import { OWNER_TYPE_LABEL, PARKING_STATUS_LABEL } from "@/modules/admin/labels";
import { listModerationQueue } from "@/modules/admin/moderation";
import { getAdminSession } from "@/modules/admin/session";
import { AccessDenied } from "../_components/access-denied";
import { FilterLink, PageHeader } from "../_components/layout-parts";
import { ModerationActions } from "../_components/moderation-actions";

type SearchParams = Promise<{ status?: string; cursor?: string }>;

const TABS = [
  { status: "PENDING_REVIEW", label: "Czekają" },
  { status: "ACTIVE", label: "Zatwierdzone" },
  { status: "REJECTED", label: "Odrzucone" },
  { status: "PAUSED", label: "Wstrzymane" },
] as const;

export default async function ModerationPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getAdminSession();
  if (!session) return <AccessDenied />;

  const params = await searchParams;
  const status = TABS.find((tab) => tab.status === params.status)?.status ?? "PENDING_REVIEW";

  const { items, nextCursor } = await listModerationQueue({
    status,
    ...(params.cursor ? { cursor: params.cursor } : {}),
    limit: 20,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Moderacja"
        description="Najdłużej czekające na górze. Odrzucenie wymaga powodu — host dostanie go w mailu."
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <FilterLink
            key={tab.status}
            href={`/admin/moderacja?status=${tab.status}`}
            active={tab.status === status}
          >
            {tab.label}
          </FilterLink>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={
            status === "PENDING_REVIEW" ? "Kolejka jest pusta" : "Nic tu nie ma w tym statusie"
          }
          description={
            status === "PENDING_REVIEW"
              ? "Żaden host nie czeka na decyzję. Kolejka zapełni się, gdy ktoś zgłosi parking do publikacji."
              : "Zmień filtr, żeby zobaczyć parkingi w innym statusie."
          }
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((parking) => {
            const prices = [
              parking.pricePerEventGr !== null
                ? { gr: parking.pricePerEventGr, per: "za wydarzenie" }
                : null,
              parking.pricePerHourGr !== null
                ? { gr: parking.pricePerHourGr, per: "za godzinę" }
                : null,
              parking.pricePerDayGr !== null ? { gr: parking.pricePerDayGr, per: "za dobę" } : null,
            ].filter((price) => price !== null);

            return (
              <li key={parking.id}>
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        icon={status === "PENDING_REVIEW" ? Clock : status === "REJECTED" ? Ban : CheckCircle2}
                        tone={
                          status === "PENDING_REVIEW"
                            ? "neutral"
                            : status === "REJECTED"
                              ? "bad"
                              : "ok"
                        }
                      >
                        {PARKING_STATUS_LABEL[parking.status]}
                      </Badge>
                      <span className="text-ui text-muted">
                        zgłoszony {formatDateTimePL(parking.createdAt)}
                      </span>
                    </div>

                    <CardTitle>{parking.title ?? "Parking bez nazwy"}</CardTitle>
                    <CardMeta>
                      {parking.address ?? "Brak adresu"} · {OWNER_TYPE_LABEL[parking.ownerType]} ·{" "}
                      {parking.companyName ?? parking.ownerName ?? parking.ownerEmail}
                    </CardMeta>
                  </CardHeader>

                  <CardBody className="flex flex-col gap-3">
                    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="flex flex-col">
                        <dt className="text-ui text-muted">Miejsca</dt>
                        <dd className="num text-body font-semibold text-ink">
                          {parking.capacity ?? "—"}
                        </dd>
                      </div>
                      <div className="flex flex-col">
                        <dt className="text-ui text-muted">Zdjęcia</dt>
                        <dd className="num flex items-center gap-1.5 text-body font-semibold text-ink">
                          <Camera size={16} aria-hidden="true" className="text-muted" />
                          {parking.photoCount}
                        </dd>
                      </div>
                      <div className="flex flex-col">
                        <dt className="text-ui text-muted">Wysokość</dt>
                        <dd className="num flex items-center gap-1.5 text-body font-semibold text-ink">
                          <Ruler size={16} aria-hidden="true" className="text-muted" />
                          {parking.maxVehicleHeightCm
                            ? formatHeight(parking.maxVehicleHeightCm)
                            : "bez limitu"}
                        </dd>
                      </div>
                      <div className="flex flex-col">
                        <dt className="text-ui text-muted">Uzupełnienie</dt>
                        <dd className="num text-body font-semibold text-ink">
                          {parking.profileCompleteness}%
                        </dd>
                      </div>
                    </dl>

                    <div className="flex flex-wrap items-baseline gap-4">
                      {prices.length === 0 ? (
                        <p className="text-ui text-danger">
                          Brak ceny. Bez ceny parking nie może być aktywny.
                        </p>
                      ) : (
                        prices.map((price) => (
                          <Price key={price.per} gr={price.gr} per={price.per} size="sm" />
                        ))
                      )}
                    </div>

                    {parking.rejectionReason ? (
                      <p className="text-ui text-muted">
                        Powód odrzucenia: {parking.rejectionReason}
                      </p>
                    ) : null}
                  </CardBody>

                  {/* A rejection is reversible from here — see modules/admin/moderation.ts. */}
                  {status === "PENDING_REVIEW" || status === "REJECTED" ? (
                    <CardFooter>
                      <ModerationActions
                        parkingId={parking.id}
                        title={parking.title ?? "Parking bez nazwy"}
                        state={status === "REJECTED" ? "rejected" : "pending"}
                      />
                    </CardFooter>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {nextCursor ? (
        <Link
          href={`/admin/moderacja?status=${status}&cursor=${nextCursor}`}
          className="inline-flex min-h-touch w-fit items-center rounded-button border border-line bg-surface px-4 text-body font-semibold text-ink transition-colors duration-micro ease-out hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Następne 20
        </Link>
      ) : null}
    </div>
  );
}
