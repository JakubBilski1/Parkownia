import { Check, Clock, MapPin, Ticket as TicketIcon, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/nav/app-shell";
import { getNavUser } from "@/components/nav/current-user";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Price } from "@/components/ui/price";
import { formatDatePL, formatTimeRangePL } from "@/lib/format";
import type { BookingStatus } from "@/db/types";
import { listBookings, type BookingListItem } from "@/modules/bookings/service";
import { getViewer } from "@/modules/bookings/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Moje rezerwacje" };

const STATUS: Record<
  BookingStatus,
  { label: string; tone: BadgeProps["tone"]; icon: LucideIcon }
> = {
  PENDING: { label: "Czeka na płatność", tone: "muted", icon: Clock },
  CONFIRMED: { label: "Opłacone", tone: "ok", icon: Check },
  USED: { label: "Wykorzystane", tone: "neutral", icon: TicketIcon },
  CANCELLED: { label: "Anulowane", tone: "muted", icon: XCircle },
  EXPIRED: { label: "Wygasłe", tone: "muted", icon: XCircle },
  NO_SHOW: { label: "Nieodebrane", tone: "muted", icon: XCircle },
};

function isLive(booking: BookingListItem): boolean {
  return booking.status === "CONFIRMED" && booking.endsAt.getTime() > Date.now();
}

export default async function MyBookingsPage() {
  const viewer = await getViewer();
  const [bookings, user] = await Promise.all([listBookings(viewer), getNavUser()]);

  return (
    <AppShell user={user} scroll>
      <div className="mx-auto flex w-full max-w-[32rem] flex-col gap-4 p-4 pb-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-h1 font-extrabold text-ink">Moje rezerwacje</h1>
        <p className="text-body text-muted">Aktywna rezerwacja jest na górze.</p>
      </header>

      {bookings.length === 0 ? (
        <EmptyState
          icon={TicketIcon}
          title="Nie masz jeszcze rezerwacji"
          description="Najbliższe mecze Lecha i targi na MTP zapełniają parkingi pod stadionem na kilka dni przed. Znajdź miejsce, zanim zrobią to inni."
          action={
            <Link href="/" className={buttonVariants({ variant: "accent", size: "lg" })}>
              Znajdź parking
            </Link>
          }
        />
      ) : null}

      <ul className="flex flex-col gap-3">
        {bookings.map((booking) => {
          const status = STATUS[booking.status];
          const live = isLive(booking);

          return (
            <li key={booking.id}>
              <Link
                href={`/rezerwacja/${booking.id}/potwierdzenie`}
                className={[
                  "press flex flex-col gap-3 rounded-card border bg-surface p-4",
                  "transition-colors duration-micro ease-out hover:bg-surface-2",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                  // The one live booking is the only thing on this screen the
                  // accent is allowed to touch, and only as a border: it is the
                  // thing the driver opened the app for.
                  live ? "border-accent shadow-card" : "border-line shadow-card",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <h2 className="font-display text-h3 font-bold text-ink">
                      {booking.parkingTitle ?? "Parking"}
                    </h2>
                    {booking.eventTitle ? (
                      <p className="text-ui text-muted">{booking.eventTitle}</p>
                    ) : null}
                    {booking.parkingAddress ? (
                      <p className="flex items-center gap-1.5 text-ui text-muted">
                        <MapPin size={14} aria-hidden="true" className="shrink-0" />
                        {booking.parkingAddress}
                      </p>
                    ) : null}
                  </div>
                  <Price gr={booking.priceGr} size="sm" />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                  <p className="num text-ui text-ink">
                    {formatDatePL(booking.startsAt)}, {formatTimeRangePL(booking.startsAt, booking.endsAt)}
                  </p>
                  <Badge tone={status.tone} icon={status.icon}>
                    {status.label}
                  </Badge>
                </div>

                {booking.code ? (
                  <p className="num font-mono text-lead font-semibold tracking-[0.06em] text-ink">
                    {booking.code}
                  </p>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
      </div>
    </AppShell>
  );
}
