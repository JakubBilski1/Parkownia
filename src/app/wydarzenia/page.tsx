import type { Metadata } from "next";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { AppShell } from "@/components/nav/app-shell";
import { getNavUser } from "@/components/nav/current-user";
import { Badge, Card, CardBody, EmptyState } from "@/components/ui";
import { formatDatePL, formatTimeRangePL } from "@/lib/format";
import { listUpcomingEvents } from "@/modules/events/service";
import { LinkButton } from "@/modules/events/ui/link-button";
import { EVENT_CATEGORY_ICON, EVENT_CATEGORY_LABEL } from "./event-meta";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wydarzenia w Poznaniu",
  description:
    "Mecze Lecha na Enea Stadionie i targi na MTP. Zobacz parkingi w promieniu wydarzenia i zarezerwuj miejsce.",
};

export default async function EventsPage() {
  const [events, user] = await Promise.all([listUpcomingEvents(), getNavUser()]);

  return (
    <AppShell user={user} scroll>
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6">
      <header className="mb-6">
        <h1 className="font-display text-h1 font-extrabold text-ink">Wydarzenia</h1>
        <p className="mt-2 text-body text-muted">
          Mecze na Enea Stadionie i targi na MTP. Wybierz wydarzenie — pokażemy parkingi w promieniu
          i wolne miejsca na te godziny.
        </p>
      </header>

      {events.length === 0 ? (
        <EmptyState
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
        <ol className="flex flex-col gap-3">
          {events.map((event) => {
            const Icon = EVENT_CATEGORY_ICON[event.category];
            return (
              <li key={event.id}>
                <Card>
                  <CardBody className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge icon={Icon} tone="neutral">
                        {EVENT_CATEGORY_LABEL[event.category]}
                      </Badge>
                      <span className="num text-ui text-muted">
                        {formatDatePL(event.startsAt)} ·{" "}
                        {formatTimeRangePL(event.startsAt, event.endsAt)}
                      </span>
                    </div>

                    <h2 className="font-display text-h3 font-bold text-ink">{event.title}</h2>

                    <p className="flex items-center gap-1.5 text-ui text-muted">
                      <MapPin size={16} aria-hidden="true" className="shrink-0" />
                      {event.venue.name}
                    </p>

                    <LinkButton
                      href={`/wydarzenia/${event.slug}`}
                      variant="accent"
                      className="self-start"
                    >
                      Zobacz parkingi
                      <ArrowRight size={18} aria-hidden="true" />
                    </LinkButton>
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
      </div>
    </AppShell>
  );
}
