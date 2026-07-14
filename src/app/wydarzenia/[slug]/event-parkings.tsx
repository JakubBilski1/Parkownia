"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import { Eye, ParkingCircle, Ruler, Umbrella } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { EventOverlay } from "@/components/map/event-overlay";
import { MapMarker, MapView } from "@/components/map/map-view";
import { PricePin } from "@/components/map/price-pin";
import { ROUTES } from "@/components/nav/routes";
import { Badge, Card, CardBody, EmptyState, Price } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatHeight, formatParkings, formatWalkDistance, formatWalkTime } from "@/lib/format";
import type { EventParking } from "@/modules/events/parkings";
import { LinkButton } from "@/modules/events/ui/link-button";

type EventParkingsProps = {
  eventId: string;
  venue: { lat: number; lng: number; name: string };
  radiusMeters: number;
  parkings: EventParking[];
};

const VENUE_ZOOM = 14;

export function EventParkings({ eventId, venue, radiusMeters, parkings }: EventParkingsProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const itemRefs = useRef(new Map<string, HTMLLIElement>());

  // The map opens on the venue, not on the driver's last viewport: this page is
  // about one place, and the radius ring has to be on screen from the first frame.
  const onReady = useCallback(
    (map: MapLibreMap) => {
      mapRef.current = map;
      map.jumpTo({ center: [venue.lng, venue.lat], zoom: VENUE_ZOOM });
    },
    [venue.lat, venue.lng],
  );

  const select = useCallback((id: string) => {
    setSelectedId(id);
    itemRefs.current.get(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;

    const parking = parkings.find((item) => item.id === selectedId);
    if (!parking) return;

    // No `essential: true` — MapLibre downgrades this to a jump under
    // prefers-reduced-motion, and that setting outranks our animation.
    map.flyTo({
      center: [parking.location.lng, parking.location.lat],
      zoom: Math.max(map.getZoom(), 15),
      duration: 400,
    });
  }, [selectedId, parkings]);

  if (parkings.length === 0) {
    return (
      <EmptyState
        icon={ParkingCircle}
        title="Nie mamy jeszcze parkingu przy tym wydarzeniu"
        description="Nikt nie udostępnił miejsca w promieniu tego wydarzenia. Masz podjazd, plac albo pusty parking firmowy w okolicy? Udostępnij go na ten jeden wieczór i zarób."
        action={
          <LinkButton href="/zostan-hostem" variant="accent">
            Udostępnij parking
          </LinkButton>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative h-[52dvh] min-h-[18rem] w-full overflow-hidden rounded-card border border-line">
        <MapView onViewportChange={() => {}} onReady={onReady} onBackgroundClick={() => setSelectedId(null)}>
          <EventOverlay center={{ lng: venue.lng, lat: venue.lat }} radiusMeters={radiusMeters} />

          {parkings.map((parking) => (
            <MapMarker
              key={parking.id}
              lng={parking.location.lng}
              lat={parking.location.lat}
              zIndex={selectedId === parking.id ? 2 : 1}
            >
              <PricePin
                priceGr={parking.priceGr}
                walkMinutes={parking.walkMinutes}
                isCovered={parking.isCovered}
                selected={selectedId === parking.id}
                onSelect={() => select(parking.id)}
              />
            </MapMarker>
          ))}
        </MapView>
      </div>

      <p className="text-ui text-muted">
        {parkings.length === 1
          ? "1 parking w promieniu wydarzenia, wolny w jego godzinach."
          : `${formatParkings(parkings.length)} w promieniu wydarzenia, wolne w jego godzinach. Najbliższy na górze.`}
      </p>

      <ol className="flex flex-col gap-3">
        {parkings.map((parking) => {
          const selected = selectedId === parking.id;
          return (
            <li
              key={parking.id}
              ref={(element) => {
                if (element) itemRefs.current.set(parking.id, element);
                else itemRefs.current.delete(parking.id);
              }}
            >
              <Card className={cn("transition-colors duration-micro ease-out", selected && "border-ink")}>
                <CardBody className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => select(parking.id)}
                    className="flex flex-col items-start gap-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    <h3 className="font-display text-h3 font-bold text-ink">
                      {parking.title ?? "Parking"}
                    </h3>
                    <p className="num text-ui text-muted">
                      {formatWalkDistance(parking.straightLineMeters)} ·{" "}
                      {formatWalkTime(parking.straightLineMeters)}
                    </p>
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    {parking.isCovered ? (
                      <Badge icon={Umbrella} tone="neutral">
                        Zadaszony
                      </Badge>
                    ) : null}
                    {parking.isGuarded ? (
                      <Badge icon={Eye} tone="neutral">
                        Dozorowany
                      </Badge>
                    ) : null}
                    {parking.maxVehicleHeightCm ? (
                      <Badge icon={Ruler} tone="neutral">
                        Do {formatHeight(parking.maxVehicleHeightCm)}
                      </Badge>
                    ) : null}
                  </div>

                  {parking.hostNotes ? <p className="text-ui text-ink">{parking.hostNotes}</p> : null}

                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                      <Price gr={parking.priceGr} per="za wydarzenie" size="md" />
                      <span className="num text-ui text-muted">
                        {parking.freeSpots === 1
                          ? "Zostało 1 miejsce"
                          : `Wolne miejsca: ${parking.freeSpots}`}
                      </span>
                    </div>

                    <LinkButton
                      href={ROUTES.reserve(parking.id, { eventId })}
                      variant="accent"
                      className="min-w-[9rem]"
                    >
                      Zarezerwuj
                    </LinkButton>
                  </div>
                </CardBody>
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
