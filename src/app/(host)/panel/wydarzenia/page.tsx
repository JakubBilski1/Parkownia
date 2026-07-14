import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { getSession, isHost } from "@/lib/session";
import { listHostEvents } from "@/modules/events/availability";
import { LinkButton } from "@/modules/events/ui/link-button";
import { HostEvents } from "./host-events";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wydarzenia w Twojej okolicy",
  robots: { index: false, follow: false },
};

export default async function HostEventsPage() {
  const session = await getSession();
  if (!session || !isHost(session)) {
    redirect("/logowanie?next=/panel/wydarzenia");
  }

  const events = await listHostEvents(session.userId);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6">
      <header className="mb-6">
        <h1 className="font-display text-h1 font-extrabold text-ink">Wydarzenia</h1>
        <p className="mt-2 text-body text-muted">
          Wydarzenia w promieniu Twoich parkingów. Przełącznik działa od razu — zapisujemy w tle.
        </p>
      </header>

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Żadne wydarzenie nie wypada w pobliżu Twoich parkingów"
          description="Pokazujemy tu tylko wydarzenia w promieniu wyszukiwania od Twoich parkingów. Dodaj parking bliżej Enea Stadionu albo MTP, a dni meczowe i targowe zaczną tu wpadać."
          action={
            <LinkButton href="/panel/parkingi/nowy" variant="accent">
              Dodaj parking
            </LinkButton>
          }
        />
      ) : (
        <HostEvents events={events} />
      )}
    </main>
  );
}
