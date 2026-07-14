import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/nav/app-shell";
import { getNavUser } from "@/components/nav/current-user";
import { Badge } from "@/components/ui";
import { formatDatePL, formatTimeRangePL } from "@/lib/format";
import { listEventParkings } from "@/modules/events/parkings";
import { getEventBySlug } from "@/modules/events/service";
import { EVENT_CATEGORY_ICON, EVENT_CATEGORY_LABEL } from "../event-meta";
import { EventParkings } from "./event-parkings";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return { title: "Nie znaleźliśmy wydarzenia" };

  return {
    title: `${event.title} — parking`,
    description: `Parkingi przy ${event.venue.name} na ${event.title}, ${formatDatePL(event.startsAt)}. Rezerwacja z góry, wjazd na kod.`,
  };
}

export default async function EventPage({ params }: PageProps) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const [parkings, user] = await Promise.all([listEventParkings(event.id), getNavUser()]);
  const Icon = EVENT_CATEGORY_ICON[event.category];

  return (
    <AppShell user={user} scroll>
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
      <Link
        href="/wydarzenia"
        className="mb-3 inline-flex min-h-touch items-center gap-1.5 text-ui text-muted transition-colors duration-micro ease-out hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Wszystkie wydarzenia
      </Link>

      <header className="mb-4 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge icon={Icon} tone="neutral">
            {EVENT_CATEGORY_LABEL[event.category]}
          </Badge>
          <span className="num text-ui text-muted">
            {formatDatePL(event.startsAt)} · {formatTimeRangePL(event.startsAt, event.endsAt)}
          </span>
        </div>

        <h1 className="font-display text-h1 font-extrabold text-ink">{event.title}</h1>

        <p className="flex items-center gap-1.5 text-body text-muted">
          <MapPin size={18} aria-hidden="true" className="shrink-0" />
          {event.venue.name}
          {event.venue.address ? `, ${event.venue.address}` : ""}
        </p>
      </header>

      <EventParkings
        eventId={event.id}
        venue={{ lat: event.venue.location.lat, lng: event.venue.location.lng, name: event.venue.name }}
        radiusMeters={event.searchRadiusMeters}
        parkings={parkings}
      />

      <p className="mt-4 text-ui text-muted">
        Odległości liczymy w linii prostej i doliczamy zapas na drogę — stąd „ok.”. Nawigacja
        prowadzi do wjazdu, nie do środka placu.
      </p>
      </div>
    </AppShell>
  );
}
