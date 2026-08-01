import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { getSession, isHost } from "@/lib/session";
import { listHostEvents } from "@/modules/events/availability";
import { countMyParkings } from "@/modules/parkings/service";
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

  const [events, parkings] = await Promise.all([
    listHostEvents(session.userId),
    countMyParkings(session.userId),
  ]);

  // listHostEvents only joins ACTIVE parkings, so "nothing nearby" was told to
  // three different people: one with no parking, one whose parking is somewhere
  // in the queue, and one whose parking was rejected. Only the first was true.
  const emptyState =
    parkings.total === 0
      ? {
          title: "Nie masz jeszcze parkingu",
          description:
            "Wydarzenia pojawią się tu, kiedy dodasz miejsce w promieniu Enea Stadionu albo MTP.",
          href: "/panel/parkingi/nowy",
          cta: "Dodaj parking",
        }
      : parkings.active === 0
        ? {
            title: "Twój parking nie jest jeszcze widoczny",
            description:
              parkings.rejected > 0
                ? "Odrzucone zgłoszenie nie bierze udziału w wydarzeniach. Powód jest przy parkingu — popraw go i wyślij ponownie, a mecze i targi zaczną tu wpadać."
                : "Wydarzenia pokazujemy dla opublikowanych parkingów. Twój czeka jeszcze na sprawdzenie albo jest szkicem.",
            href: "/panel/parkingi",
            cta: "Otwórz moje parkingi",
          }
        : {
            title: "Żadne wydarzenie nie wypada w pobliżu Twoich parkingów",
            description:
              "Pokazujemy tu tylko wydarzenia w promieniu wyszukiwania od Twoich parkingów. Dodaj parking bliżej Enea Stadionu albo MTP, a dni meczowe i targowe zaczną tu wpadać.",
            href: "/panel/parkingi/nowy",
            cta: "Dodaj parking",
          };

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
          title={emptyState.title}
          description={emptyState.description}
          action={
            <LinkButton href={emptyState.href} variant="accent">
              {emptyState.cta}
            </LinkButton>
          }
        />
      ) : (
        <HostEvents events={events} />
      )}
    </main>
  );
}
