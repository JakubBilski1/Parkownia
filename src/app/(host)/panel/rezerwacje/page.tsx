import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES } from "@/components/nav/routes";
import { Check, Clock, LockKeyhole, ScanLine, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PwaRegister } from "@/components/pwa-register";
import { formatDatePL, formatSpots, formatTimeRangePL } from "@/lib/format";
import { listHostBookings, type HostBookingRow } from "@/modules/scan/host-bookings";
import { getHostSession } from "@/modules/scan/session";

export const metadata: Metadata = {
  title: "Rezerwacje",
  manifest: "/manifest.json",
};

export const dynamic = "force-dynamic";

type Search = { zakres?: string };

export default async function HostBookingsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await getHostSession();

  if (!session) {
    return (
      <main className="mx-auto flex min-h-full w-full max-w-[32rem] items-center p-4">
        <EmptyState
          icon={LockKeyhole}
          title="Rezerwacje są dla hostów"
          description="Zaloguj się na konto, na którym masz parking."
          action={
            <Link
              href={ROUTES.login}
              className="inline-flex min-h-touch items-center rounded-button border border-line bg-surface px-4 font-semibold text-ink"
            >
              Zaloguj się
            </Link>
          }
        />
      </main>
    );
  }

  const { zakres } = await searchParams;
  const scope = zakres === "nadchodzace" ? "upcoming" : "today";
  const rows = await listHostBookings(session.userId, scope);

  return (
    <>
      <PwaRegister />
      <main className="mx-auto flex min-h-full w-full max-w-[40rem] flex-col gap-4 p-4">
        <header className="flex flex-col gap-1">
          <h1 className="font-display text-h2 font-bold text-ink">Rezerwacje</h1>
          <p className="text-ui text-muted">
            Kto przyjedzie na Twoje parkingi. Kodów tu nie ma — sprawdzasz je skanerem.
          </p>
        </header>

        <nav className="flex gap-2" aria-label="Zakres">
          <ScopeLink active={scope === "today"} href={ROUTES.host.bookings}>
            Dziś
          </ScopeLink>
          <ScopeLink active={scope === "upcoming"} href={`${ROUTES.host.bookings}?zakres=nadchodzace`}>
            Nadchodzące
          </ScopeLink>
        </nav>

        {rows.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title={scope === "today" ? "Dziś nikt nie przyjedzie" : "Brak nadchodzących rezerwacji"}
            description="Udostępnij parking na najbliższy event — mecz albo targi ściągają kierowców, którzy szukają miejsca kilka dni wcześniej."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li key={row.id}>
                <BookingCard row={row} />
              </li>
            ))}
          </ul>
        )}

        <Link
          href={ROUTES.host.scanner}
          className="press mt-auto inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-button bg-accent px-6 font-semibold text-accent-ink"
        >
          <ScanLine size={20} aria-hidden="true" />
          Otwórz skaner
        </Link>
      </main>
    </>
  );
}

function BookingCard({ row }: { row: HostBookingRow }) {
  return (
    <Card>
      <CardBody className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="num text-body font-semibold text-ink">
            {formatDatePL(row.startsAt)} · {formatTimeRangePL(row.startsAt, row.endsAt)}
          </p>
          <p className="truncate text-ui text-muted">
            {row.parkingTitle}
            {row.eventTitle ? ` · ${row.eventTitle}` : ""}
          </p>
          <p className="num text-ui text-muted">
            {formatSpots(row.spots)}
            {row.vehiclePlate ? ` · ${row.vehiclePlate}` : ""}
          </p>
        </div>

        {row.status === "USED" ? (
          <Badge tone="ok" icon={Check}>
            Wjechał
          </Badge>
        ) : (
          <Badge tone="neutral" icon={Clock}>
            Oczekuje
          </Badge>
        )}
      </CardBody>
    </Card>
  );
}

function ScopeLink({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "inline-flex min-h-touch items-center rounded-pill border px-4 text-ui font-semibold",
        active
          ? "border-selected bg-selected text-selected-ink"
          : "border-line bg-surface text-ink",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}
