import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDatePL, formatSpots, formatTimeRangePL } from "@/lib/format";
import { listUpcomingEvents } from "@/modules/admin/events";
import { EVENT_CATEGORY_LABEL } from "@/modules/admin/labels";
import { getAdminSession } from "@/modules/admin/session";
import { utcToWarsawInput } from "@/modules/admin/time";
import { listVenues } from "@/modules/admin/venues";
import { AccessDenied } from "../_components/access-denied";
import {
  DeleteEventButton,
  DeleteVenueButton,
  EventFormDialog,
  VenueForm,
} from "../_components/event-forms";
import { PageHeader, Section, TableScroll, Td, Th } from "../_components/layout-parts";

export default async function EventsPage() {
  const session = await getAdminSession();
  if (!session) return <AccessDenied />;

  const [events, venues] = await Promise.all([listUpcomingEvents(50), listVenues()]);
  const venueOptions = venues.map((venue) => ({ id: venue.id, name: venue.name }));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Wydarzenia"
        description="Nadchodzące wydarzenia i obiekty. Deklaracje hostów pokazują, ile podaży już mamy."
        action={
          venueOptions.length > 0 ? (
            <EventFormDialog venues={venueOptions} trigger="primary" />
          ) : null
        }
      />

      <Section title="Nadchodzące" hint="Chronologicznie, najbliższe na górze.">
        {events.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nie ma nadchodzących wydarzeń"
            description={
              venueOptions.length === 0
                ? "Najpierw dodaj obiekt — bez niego nie ma gdzie umieścić wydarzenia."
                : "Dodaj mecz albo targi, a hostowie w promieniu dostaną pytanie o udostępnienie miejsc."
            }
          />
        ) : (
          <TableScroll>
            <thead>
              <tr>
                <Th>Wydarzenie</Th>
                <Th>Kiedy</Th>
                <Th>Obiekt</Th>
                <Th className="text-right">Promień</Th>
                <Th className="text-right">Deklaracje</Th>
                <Th className="text-right">Sprzedane</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <Td className="text-ink">
                    <span className="font-semibold">{event.title}</span>
                    <br />
                    <span className="text-ui text-muted">{EVENT_CATEGORY_LABEL[event.category]}</span>
                  </Td>

                  <Td className="num whitespace-nowrap text-muted">
                    {formatDatePL(event.startsAt)}
                    <br />
                    {formatTimeRangePL(event.startsAt, event.endsAt)}
                  </Td>

                  <Td className="text-muted">{event.venueName}</Td>

                  <Td className="num text-right text-muted">{event.searchRadiusMeters} m</Td>

                  <Td className="num text-right text-ink">
                    {event.declaredParkings}
                    <br />
                    <span className="text-ui text-muted">{formatSpots(event.declaredSpots)}</span>
                  </Td>

                  <Td className="num text-right text-ink">{event.bookingCount}</Td>

                  <Td>
                    <div className="flex items-center justify-end gap-2">
                      <EventFormDialog
                        venues={venueOptions}
                        trigger="quiet"
                        event={{
                          id: event.id,
                          venueId: event.venueId,
                          title: event.title,
                          description: null,
                          startsAtLocal: utcToWarsawInput(event.startsAt),
                          endsAtLocal: utcToWarsawInput(event.endsAt),
                          category: event.category,
                          expectedAttendance: event.expectedAttendance,
                          searchRadiusMeters: event.searchRadiusMeters,
                        }}
                      />
                      <DeleteEventButton eventId={event.id} title={event.title} />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableScroll>
        )}
      </Section>

      <Section title="Obiekty" hint="Stadion, hala, teren targowy. Współrzędne wyznaczają środek promienia.">
        <VenueForm />

        {venues.length === 0 ? (
          <EmptyState
            title="Nie ma żadnego obiektu"
            description="Dodaj Enea Stadion i MTP — to od nich zaczyna się cała podaż parkingów w Poznaniu."
          />
        ) : (
          <TableScroll>
            <thead>
              <tr>
                <Th>Nazwa</Th>
                <Th>Adres</Th>
                <Th className="text-right">Współrzędne</Th>
                <Th className="text-right">Wydarzenia</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {venues.map((venue) => (
                <tr key={venue.id}>
                  <Td className="font-semibold text-ink">{venue.name}</Td>
                  <Td className="text-muted">{venue.address ?? "—"}</Td>
                  <Td className="num text-right font-mono text-ui text-muted">
                    {venue.location.lat.toFixed(4)}, {venue.location.lng.toFixed(4)}
                  </Td>
                  <Td className="num text-right text-muted">{venue.eventCount}</Td>
                  <Td className="text-right">
                    {venue.eventCount === 0 ? (
                      <DeleteVenueButton venueId={venue.id} />
                    ) : (
                      <span className="text-ui text-muted">ma wydarzenia</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableScroll>
        )}
      </Section>
    </div>
  );
}
