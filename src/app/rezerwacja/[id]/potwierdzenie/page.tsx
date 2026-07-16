import { Check, Clock, DoorOpen, Navigation, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Price } from "@/components/ui/price";
import { Ticket, TicketCode, TicketMain, TicketStub } from "@/components/ui/ticket";
import { formatDatePL, formatMoney, formatTimePL, formatTimeRangePL } from "@/lib/format";
import { DomainError } from "@/modules/bookings/errors";
import { getBookingDetail } from "@/modules/bookings/service";
import { getViewer } from "@/modules/bookings/session";
import { CancelBooking } from "./cancel-booking";
import { PendingWatcher } from "./pending-watcher";

export const dynamic = "force-dynamic";

/** Speak the driver's language, not the schema's (DESIGN_PRINCIPLES §6.2). */
const ACCESS_LABEL: Record<string, string> = {
  OPEN: "Wjazd otwarty, bez szlabanu",
  BARRIER_CODE: "Szlaban otwierany na kod",
  BARRIER_REMOTE: "Szlaban otwierany pilotem",
  GATE_MANUAL: "Bramę otwiera obsługa",
  LPR: "Szlaban czyta tablicę rejestracyjną",
  KEY_HANDOVER: "Klucz odbierasz na miejscu",
  ATTENDANT: "Na miejscu jest obsługa",
};

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getViewer();

  let booking;
  try {
    booking = await getBookingDetail(id, viewer);
  } catch (error) {
    if (error instanceof DomainError && error.code === "BOOKING_NOT_FOUND") notFound();
    if (error instanceof DomainError && error.code === "FORBIDDEN") {
      return (
        <main className="mx-auto flex min-h-dvh w-full max-w-[32rem] flex-col gap-4 p-4">
          <Card>
            <CardBody className="flex flex-col gap-2">
              <h1 className="font-display text-h2 font-extrabold text-ink">
                To nie jest Twoja rezerwacja
              </h1>
              <p className="text-body text-muted">
                Otwórz link z maila, którym płaciłeś, albo zaloguj się na konto, na które
                kupowałeś miejsce.
              </p>
            </CardBody>
          </Card>
        </main>
      );
    }
    throw error;
  }

  const paid = booking.status === "CONFIRMED" || booking.status === "USED";

  return (
    <main
      className={`mx-auto flex min-h-dvh w-full max-w-[32rem] flex-col gap-4 p-4 pb-8 ${paid ? "lg:max-w-4xl" : ""}`}
    >
      {booking.status === "PENDING" ? <PendingWatcher /> : null}

      <header className="flex flex-col gap-2">
        <h1 className="font-display text-h1 font-extrabold text-ink">
          {paid ? "Masz miejsce." : null}
          {booking.status === "PENDING" ? "Czekamy na płatność." : null}
          {booking.status === "EXPIRED" ? "Rezerwacja wygasła." : null}
          {booking.status === "CANCELLED" ? "Rezerwacja anulowana." : null}
          {booking.status === "NO_SHOW" ? "Nie pojawiłeś się." : null}
        </h1>

        {paid ? (
          <Badge tone="ok" icon={Check} className="self-start">
            {booking.status === "USED" ? "Kod użyty przy wjeździe" : "Opłacone"}
          </Badge>
        ) : null}
      </header>

      {paid ? (
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-10">
          {/* The ticket is the object the driver came for: first on a phone, a
              sticky rail on desktop so the QR stays in view while the entry
              instructions sit beside it rather than below a lot of empty space. */}
          <div className="lg:order-2 lg:sticky lg:top-6">
          <Ticket>
            <TicketMain className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <h2 className="font-display text-h3 font-bold text-ink">
                    {booking.parking.title ?? "Parking"}
                  </h2>
                  {booking.parking.address ? (
                    <p className="text-ui text-muted">{booking.parking.address}</p>
                  ) : null}
                </div>
                <Price gr={booking.priceGr} size="md" />
              </div>

              <dl className="flex flex-col gap-1.5 border-t border-line pt-3 text-body">
                {booking.event ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Wydarzenie</dt>
                    <dd className="text-right text-ink">{booking.event.title}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Data</dt>
                  <dd className="num text-right text-ink">{formatDatePL(booking.startsAt)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Godziny</dt>
                  <dd className="num text-right text-ink">
                    {formatTimeRangePL(booking.startsAt, booking.endsAt)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Miejsca</dt>
                  <dd className="num text-right text-ink">{booking.spots}</dd>
                </div>
              </dl>
            </TicketMain>

            <TicketStub className="flex flex-col items-center gap-4">
              {booking.qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL, generated per request; next/image would round-trip it through the optimizer for nothing.
                <img
                  src={booking.qrDataUrl}
                  alt={`Kod QR rezerwacji ${booking.code}`}
                  width={220}
                  height={220}
                  className="h-[13.75rem] w-[13.75rem] rounded-chip"
                />
              ) : null}

              {booking.code ? <TicketCode code={booking.code} className="items-center" /> : null}

              <p className="text-center text-ui text-muted">
                Pokaż ten kod przy wjeździe. Działa też bez zasięgu — zrób zrzut ekranu.
              </p>
            </TicketStub>
          </Ticket>
          </div>

          <div className="flex flex-col gap-4 lg:order-1">
          <Card>
            <CardBody className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 font-display text-h3 font-bold text-ink">
                <DoorOpen size={20} aria-hidden="true" />
                Jak wjechać
              </h2>

              {booking.parking.accessType ? (
                <p className="text-body text-ink">
                  {ACCESS_LABEL[booking.parking.accessType] ?? booking.parking.accessType}
                </p>
              ) : null}

              {booking.accessInstructions ? (
                <p className="whitespace-pre-line text-body text-ink">
                  {booking.accessInstructions}
                </p>
              ) : null}

              {booking.entranceNotes ? (
                <p className="text-body text-muted">{booking.entranceNotes}</p>
              ) : null}

              {booking.entranceLocation ? (
                <>
                  <p className="text-ui text-muted">
                    Nawigacja prowadzi do wjazdu, nie do środka placu.
                  </p>
                  {/* A deep link into whatever maps app the driver already has —
                      not an embedded Google Maps SDK, which the project forbids
                      and which would be useless for turn-by-turn anyway. */}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${booking.entranceLocation.lat},${booking.entranceLocation.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({ variant: "quiet", size: "md", block: true })}
                  >
                    <Navigation size={18} aria-hidden="true" />
                    Nawiguj do wjazdu
                  </a>
                </>
              ) : null}
            </CardBody>
          </Card>

          {booking.status === "CONFIRMED" ? <CancelBooking bookingId={booking.id} /> : null}
          </div>
        </div>
      ) : null}

      {booking.status === "PENDING" ? (
        <Card>
          <CardBody className="flex flex-col gap-3">
            <p className="flex items-center gap-2 text-body text-ink">
              <Clock size={20} aria-hidden="true" className="text-muted" />
              Potwierdzamy płatność u operatora. To zwykle kilka sekund.
            </p>
            <p className="text-body text-muted">
              Kod i instrukcję wjazdu pokażemy tutaj, gdy pieniądze dojdą. Ta strona odświeża się
              sama.
            </p>
            {booking.pendingExpiresAt ? (
              <p className="num text-ui text-muted">
                Miejsce trzymamy do {formatTimePL(booking.pendingExpiresAt)}.
              </p>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {booking.status === "EXPIRED" ? (
        <Card>
          <CardBody className="flex flex-col gap-3">
            <p className="flex items-start gap-2 text-body text-ink">
              <XCircle size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-danger" />
              Trzymaliśmy miejsce przez 15 minut i płatność nie doszła.
            </p>
            <p className="text-body text-muted">
              Nie pobraliśmy żadnych pieniędzy. Jeśli zapłaciłeś, a widzisz ten ekran — zwrócimy
              wszystko automatycznie i napiszemy Ci maila.
            </p>
            <Link
              href={`/rezerwacja/${booking.parking.id}`}
              className={buttonVariants({ variant: "accent", size: "lg", block: true })}
            >
              Zarezerwuj jeszcze raz
            </Link>
          </CardBody>
        </Card>
      ) : null}

      {booking.status === "CANCELLED" ? (
        <Card>
          <CardBody className="flex flex-col gap-2">
            <p className="text-body text-ink">Miejsce wróciło do sprzedaży.</p>
            <p className="text-body text-muted">
              {booking.refundGr && booking.refundGr > 0
                ? `Zwracamy ${formatMoney(booking.refundGr)}. Pieniądze wrócą tą samą drogą, którą przyszły, w ciągu kilku dni.`
                : "Zgodnie z polityką zwrotów, przy anulowaniu tak blisko terminu nie zwracamy pieniędzy."}
            </p>
          </CardBody>
        </Card>
      ) : null}

      <Link
        href="/moje-rezerwacje"
        className="inline-flex min-h-touch items-center justify-center self-center text-ui font-semibold text-muted transition-colors duration-micro ease-out hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        Moje rezerwacje
      </Link>
    </main>
  );
}
