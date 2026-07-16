import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { AppShell } from "@/components/nav/app-shell";
import { getNavUser } from "@/components/nav/current-user";
import { EmptyState, PageContainer } from "@/components/ui";
import { listUpcomingEvents } from "@/modules/events/service";
import { LinkButton } from "@/modules/events/ui/link-button";
import { EventCard, NextEventHero } from "./event-cards";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wydarzenia w Poznaniu",
  description:
    "Mecze Lecha na Enea Stadionie i targi na MTP. Zobacz parkingi w promieniu wydarzenia i zarezerwuj miejsce.",
};

export default async function EventsPage() {
  const [events, user] = await Promise.all([listUpcomingEvents(), getNavUser()]);

  // listUpcomingEvents orders by startsAt, so the first row is the soonest —
  // the one worth the hero. The rest keep the grid.
  const [next, ...rest] = events;

  return (
    <AppShell user={user} scroll>
      <PageContainer width="wide" className="pb-16 pt-6 lg:pt-10">
      <header className="mb-6 lg:mb-8">
        <h1 className="font-display text-h1 font-extrabold text-ink">Wydarzenia</h1>
        <p className="mt-2 max-w-2xl text-body text-muted">
          Mecze na Enea Stadionie i targi na MTP. Wybierz wydarzenie — pokażemy parkingi w promieniu
          i wolne miejsca na te godziny.
        </p>
      </header>

      {!next ? (
        <EmptyState
          className="mx-auto max-w-lg"
          icon={CalendarDays}
          title="Nie mamy jeszcze żadnego wydarzenia"
          description="Kolejne mecze i targi pojawią się tutaj, gdy poznamy terminy. Masz miejsce przy stadionie albo MTP? Udostępnij je i zarabiaj w dni meczowe."
          action={
            <LinkButton href="/zostan-hostem" variant="accent">
              Udostępnij parking
            </LinkButton>
          }
        />
      ) : (
        <>
          <NextEventHero event={next} />

          {rest.length > 0 ? (
            <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rest.map((event) => (
                <li key={event.id} className="flex">
                  <EventCard event={event} />
                </li>
              ))}
            </ol>
          ) : null}
        </>
      )}
      </PageContainer>
    </AppShell>
  );
}
