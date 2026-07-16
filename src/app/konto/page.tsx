import { Ticket as TicketIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/nav/app-shell";
import { getNavUser } from "@/components/nav/current-user";
import { ROUTES } from "@/components/nav/routes";
import { PageContainer, Price } from "@/components/ui";
import { formatDatePL, formatTimeRangePL } from "@/lib/format";
import { getSession } from "@/lib/session";
import { listBookings, type BookingListItem } from "@/modules/bookings/service";
import { getViewer } from "@/modules/bookings/session";
import { listConsents } from "@/modules/users/consents";
import { getProfile } from "@/modules/users/service";
import { ConsentsPanel, type ConsentView } from "./_components/consents-panel";
import { DataExportCard } from "./_components/data-export-card";
import { DeleteAccountCard } from "./_components/delete-account-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Konto" };

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-h3 font-bold text-ink">{title}</h2>
        {description ? <p className="text-ui text-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function DataRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-line py-2 last:border-b-0">
      <dt className="text-ui text-muted">{label}</dt>
      <dd className="num text-body text-ink">{value ?? "—"}</dd>
    </div>
  );
}

/** CONFIRMED and not over yet — the thing the driver opened the app for (§6.5). */
function findLive(bookings: BookingListItem[]): BookingListItem | undefined {
  const now = Date.now();
  return bookings.find(
    (booking) => booking.status === "CONFIRMED" && booking.endsAt.getTime() > now,
  );
}

export default async function AccountPage() {
  const session = await getSession();
  if (!session) {
    redirect("/logowanie?next=/konto");
  }

  const [profile, consents, viewer, navUser] = await Promise.all([
    getProfile(session.userId),
    listConsents(session.userId),
    getViewer(),
    getNavUser(),
  ]);

  const live = findLive(await listBookings(viewer));

  const consentViews: ConsentView[] = consents.map((consent) => ({
    kind: consent.kind,
    granted: consent.granted,
    documentVersion: consent.documentVersion,
    grantedAt: consent.grantedAt?.toISOString() ?? null,
    withdrawnAt: consent.withdrawnAt?.toISOString() ?? null,
  }));

  const isHost = profile.roles.some(
    (role) => role === "HOST_INDIVIDUAL" || role === "HOST_BUSINESS",
  );

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || null;

  return (
    <AppShell user={navUser} scroll>
      <PageContainer width="prose" className="flex flex-col gap-4 py-4 pb-8">
        <header className="flex flex-col gap-1">
          <h1 className="font-display text-h1 font-extrabold text-ink">Konto</h1>
          <p className="text-body text-muted">
            Twoje dane, zgody i to, co możesz z nimi zrobić.
          </p>
        </header>

        {live ? (
          <section className="flex flex-col gap-1">
            <h2 className="text-ui font-semibold text-muted">Aktywna rezerwacja</h2>
            <Link
              href={ROUTES.booking(live.id)}
              className={[
                "press flex flex-col gap-3 rounded-card border border-accent bg-surface p-4 shadow-card",
                "transition-colors duration-micro ease-out hover:bg-surface-2",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="font-display text-h3 font-bold text-ink">
                    {live.parkingTitle ?? "Parking"}
                  </h3>
                  <p className="num text-ui text-muted">
                    {formatDatePL(live.startsAt)},{" "}
                    {formatTimeRangePL(live.startsAt, live.endsAt)}
                  </p>
                </div>
                <Price gr={live.priceGr} size="sm" />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                {live.code ? (
                  <p className="num font-mono text-h2 font-semibold tracking-[0.06em] text-ink">
                    {live.code}
                  </p>
                ) : null}
                <span className="inline-flex items-center gap-1.5 text-ui font-semibold text-ink">
                  <TicketIcon size={16} aria-hidden="true" />
                  Pokaż bilet
                </span>
              </div>
            </Link>
          </section>
        ) : null}

        <Section title="Moje dane">
          <dl className="flex flex-col">
            <DataRow label="Imię i nazwisko" value={fullName} />
            <DataRow label="E-mail" value={profile.email} />
            <DataRow label="Telefon" value={profile.phone} />
          </dl>
        </Section>

        <Section
          title="Zgody"
          description="Marketing możesz wyłączyć w każdej chwili. Zmiana działa od razu."
        >
          <ConsentsPanel initial={consentViews} />
        </Section>

        <Section title="Eksport danych">
          <DataExportCard email={profile.email} />
        </Section>

        {/*
          Destructive action, last on the page and inside its own frame: it does
          not sit next to anything that moves the user forward (§6.6). Getting
          here takes a scroll, and that is deliberate.
        */}
        <section className="mt-6 flex flex-col gap-3 rounded-card border border-danger bg-surface p-4">
          <h2 className="font-display text-h3 font-bold text-ink">Usunięcie konta</h2>
          <DeleteAccountCard isHost={isHost} />
        </section>
      </PageContainer>
    </AppShell>
  );
}
