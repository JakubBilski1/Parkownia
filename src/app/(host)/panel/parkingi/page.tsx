import { Check, CircleAlert, Clock, FileText, PauseCircle, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Badge,
  buttonVariants,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardMeta,
  CardTitle,
  EmptyState,
  PageContainer,
  Price,
  Progress,
} from "@/components/ui";
import { ROUTES } from "@/components/nav/routes";
import type { ParkingStatus } from "@/db/types";
import { formatDateTimePL } from "@/lib/format";
import { listMyParkings, type HostParkingRow } from "@/modules/parkings/service";
import { getSession } from "@/modules/parkings/session";
import { ParkingActions } from "./_components/parking-actions";

export const metadata: Metadata = { title: "Moje parkingi" };
export const dynamic = "force-dynamic";

const STATUS: Record<
  ParkingStatus,
  { label: string; icon: typeof Check; tone: "neutral" | "ok" | "bad" | "muted"; note?: string }
> = {
  DRAFT: { label: "Szkic", icon: FileText, tone: "muted", note: "Nikt go jeszcze nie widzi." },
  PENDING_REVIEW: {
    label: "Czeka na sprawdzenie",
    icon: Clock,
    tone: "neutral",
    note: "Zwykle trwa to do 24 godzin.",
  },
  // Neutral, not green: scan-ok belongs to the scanner and to errors, not to a
  // list badge. The icon and the label carry the status without leaning on hue.
  ACTIVE: { label: "W sprzedaży", icon: Check, tone: "neutral" },
  PAUSED: {
    label: "Wstrzymany",
    icon: PauseCircle,
    tone: "muted",
    note: "Nie pokazujemy go na mapie.",
  },
  REJECTED: { label: "Odrzucony", icon: CircleAlert, tone: "bad" },
};

function priceOf(parking: HostParkingRow): { gr: number; per: string } | null {
  if (parking.pricePerEventGr !== null) return { gr: parking.pricePerEventGr, per: "za wydarzenie" };
  if (parking.pricePerHourGr !== null) return { gr: parking.pricePerHourGr, per: "za godzinę" };
  if (parking.pricePerDayGr !== null) return { gr: parking.pricePerDayGr, per: "za dobę" };
  return null;
}

export default async function HostParkingsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/logowanie?next=/panel/parkingi");
  }

  const isHost = session.roles.some(
    (role) => role === "HOST_INDIVIDUAL" || role === "HOST_BUSINESS",
  );

  if (!isHost) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        <h1 className="font-display text-h1 text-ink">Twoje parkingi</h1>
        <EmptyState
          title="Nie udostępniasz jeszcze miejsc"
          description="Masz podwórko, garaż albo firmowy plac, który po godzinach stoi pusty? W promieniu kilometra od Enea Stadionu odbywa się kilkanaście meczów w sezonie. Każdy z nich to 40 tysięcy ludzi szukających miejsca."
          // ROUTES.becomeHost, not /konto/zostan-hostem — that route does not exist,
          // and this CTA sits at the very top of the supply funnel.
          action={
            <Link
              href={ROUTES.becomeHost}
              className={buttonVariants({ variant: "accent", size: "lg" })}
            >
              Zacznij zarabiać na parkingu
            </Link>
          }
        />
      </div>
    );
  }

  const parkings = await listMyParkings(session);

  return (
    <PageContainer width="wide" className="flex flex-col gap-4 py-4 pb-24">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-h1 text-ink">Twoje parkingi</h1>
        <Link href="/panel/parkingi/nowy" className={buttonVariants({ variant: "accent" })}>
          <Plus size={18} aria-hidden="true" />
          Dodaj
        </Link>
      </header>

      {parkings.length === 0 ? (
        <EmptyState
          className="mx-auto max-w-lg"
          title="Nie masz jeszcze żadnego parkingu"
          description="Dodanie zajmuje minutę: nazwa, pinezka na mapie, liczba miejsc i cena. Resztę uzupełnisz później — szkic zapisuje się sam."
          action={
            <Link
              href="/panel/parkingi/nowy"
              className={buttonVariants({ variant: "accent", size: "lg" })}
            >
              Dodaj pierwszy parking
            </Link>
          }
        />
      ) : null}

      {/* Cards are self-contained, so on a desktop they pair up instead of
          running as one column down the middle of a 1152px shell. */}
      <div className="grid gap-4 lg:grid-cols-2">
        {parkings.map((parking) => {
          const status = STATUS[parking.status];
          const price = priceOf(parking);

          return (
            <Card key={parking.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle>{parking.title ?? "Parking bez nazwy"}</CardTitle>
                  <Badge tone={status.tone} icon={status.icon}>
                    {status.label}
                  </Badge>
                </div>
                <CardMeta>{parking.address ?? "Brak adresu"}</CardMeta>
              </CardHeader>

              <CardBody className="flex flex-1 flex-col gap-3">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  {price ? <Price gr={price.gr} per={price.per} size="sm" /> : null}
                  <span className="num text-ui text-muted">
                    {parking.capacity ?? 0} {parking.capacity === 1 ? "miejsce" : "miejsc"}
                  </span>
                  <span className="num text-ui text-muted">
                    {parking.photoCount} {parking.photoCount === 1 ? "zdjęcie" : "zdjęć"}
                  </span>
                </div>

                {parking.status === "REJECTED" && parking.rejectionReason ? (
                  <p className="rounded-chip border border-danger bg-danger-soft p-3 text-ui text-ink">
                    <span className="font-semibold">Dlaczego odrzucony: </span>
                    {parking.rejectionReason}
                  </p>
                ) : null}

                {status.note ? <p className="text-ui text-muted">{status.note}</p> : null}

                <Progress
                  value={parking.profileCompleteness}
                  label="Kompletność profilu"
                  hint={`${parking.profileCompleteness}%`}
                />

                <p className="text-ui text-muted">
                  Ostatnia zmiana: {formatDateTimePL(parking.updatedAt)}
                </p>
              </CardBody>

              <CardFooter>
                <Link
                  href={`/panel/parkingi/${parking.id}/edytuj`}
                  className={buttonVariants({ size: "sm" })}
                >
                  Edytuj
                </Link>
                <ParkingActions parkingId={parking.id} status={parking.status} />
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </PageContainer>
  );
}
