"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Chip, EmptyState, Skeleton } from "@/components/ui";
import { ROUTES } from "@/components/nav/routes";
import { useMapParkings } from "@/hooks/use-map-parkings";
import { formatDatePL, formatTimePL } from "@/lib/format";
import { ActiveBookingBanner } from "./active-booking-banner";
import { ClusterLayer } from "./cluster-layer";
import { EventOverlay } from "./event-overlay";
import { GeolocateButton } from "./geolocate-button";
import { circleBounds, straightLineMeters } from "./geo-display";
import { MapView, type Viewport } from "./map-view";
import { MapFiltersBar } from "./map-filters";
import { ParkingSheet } from "./parking-sheet";
import {
  EMPTY_FILTERS,
  mapEventsResponseSchema,
  type LngLat,
  type MapEvent,
  type MapFilters,
} from "./types";

export function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<MapLibreMap | null>(null);

  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [filters, setFilters] = useState<MapFilters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userPosition, setUserPosition] = useState<LngLat | null>(null);
  const [events, setEvents] = useState<MapEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const { pins, isInitialLoading, error, retry } = useMapParkings(
    viewport?.bbox ?? null,
    filters,
  );

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/events?upcoming=true", {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) return;
        const parsed = mapEventsResponseSchema.safeParse(await response.json());
        if (parsed.success) setEvents(parsed.data.items);
      })
      .catch(() => {
        // The map works without events; a failed strip stays hidden.
      });

    return () => controller.abort();
  }, []);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  // Walk times are measured to the venue once an event is picked, otherwise to
  // the driver's own position. With neither, the pin simply does not claim one.
  const reference: LngLat | null = selectedEvent
    ? { lng: selectedEvent.venue.lng, lat: selectedEvent.venue.lat }
    : userPosition;

  const selectPin = useCallback((pinId: string) => setSelectedId(pinId), []);

  const chooseEvent = useCallback(
    (event: MapEvent) => {
      const next = event.id === selectedEventId ? null : event;
      setSelectedEventId(next?.id ?? null);
      if (!next) return;
      // Frame the whole search radius, not an arbitrary zoom: the ring is the
      // area the parkings come from, and a driver who cannot see its edge cannot
      // tell what "blisko stadionu" means here. The camera flies rather than
      // jumps so spatial continuity survives (MapLibre drops the animation
      // itself under prefers-reduced-motion). Padding keeps the venue clear of
      // the floating chrome above and below.
      const bounds = circleBounds(
        { lng: next.venue.lng, lat: next.venue.lat },
        next.searchRadiusMeters,
      );
      mapRef.current?.fitBounds(
        [
          [bounds.west, bounds.south],
          [bounds.east, bounds.north],
        ],
        {
          padding: { top: 150, bottom: 60, left: 24, right: 24 },
          maxZoom: 16,
          duration: 400,
        },
      );
    },
    [selectedEventId],
  );

  const selectedPin = pins.find((pin) => pin.id === selectedId) ?? null;
  const selectedDistance =
    selectedPin && reference
      ? straightLineMeters(reference, { lng: selectedPin.lng, lat: selectedPin.lat })
      : null;

  const showEmpty = !isInitialLoading && !error && pins.length === 0;

  return (
    // Fills the positioned <main> of the shell. A percentage height would depend
    // on a definite height up the flex chain and silently collapse the canvas.
    <div className="absolute inset-0">
      <MapView
        onViewportChange={setViewport}
        onReady={(map) => {
          mapRef.current = map;
        }}
        onBackgroundClick={() => setSelectedId(null)}
      >
        <ClusterLayer
          pins={pins}
          viewport={viewport}
          selectedId={selectedId}
          onSelect={selectPin}
          reference={reference}
        />
        <EventOverlay
          center={
            selectedEvent
              ? { lng: selectedEvent.venue.lng, lat: selectedEvent.venue.lat }
              : null
          }
          radiusMeters={selectedEvent?.searchRadiusMeters ?? 1500}
        />
      </MapView>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <ActiveBookingBanner className="pointer-events-auto" />

        {events.length > 0 ? (
          <div className="pointer-events-auto flex gap-2 overflow-x-auto pb-1">
            {events.map((event) => (
              <Chip
                key={event.id}
                selected={event.id === selectedEventId}
                onClick={() => chooseEvent(event)}
              >
                <span className="flex flex-col items-start">
                  <span>{event.title}</span>
                  <span className="num text-ui font-normal opacity-80">
                    {formatDatePL(event.startsAt)}, {formatTimePL(event.startsAt)}
                  </span>
                </span>
              </Chip>
            ))}
          </div>
        ) : null}

        <MapFiltersBar
          filters={filters}
          onChange={setFilters}
          className="pointer-events-auto"
        />
      </div>

      {/* The bottom strip is left clear on purpose: the OSM attribution lives
          there and covering it would breach the tile licence. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-end gap-3 p-3 pb-[calc(1.75rem+env(safe-area-inset-bottom))]">
        <GeolocateButton
          onLocated={setUserPosition}
          className="pointer-events-auto mr-1"
        />

        {isInitialLoading ? (
          <div
            aria-busy="true"
            className="pointer-events-auto w-full rounded-card border border-line bg-surface p-3 shadow-float md:w-auto md:max-w-sm"
          >
            <span className="sr-only">Szukamy parkingów w tym widoku.</span>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="pointer-events-auto flex w-full flex-col items-start gap-2 rounded-card border border-danger bg-surface p-3 shadow-float md:w-auto md:max-w-sm">
            <p className="text-body text-ink">{error}</p>
            <Button variant="quiet" size="sm" onClick={retry}>
              Spróbuj ponownie
            </Button>
          </div>
        ) : null}

        {showEmpty ? (
          <EmptyState
            className="pointer-events-auto w-full shadow-float md:w-auto md:max-w-md"
            title={
              selectedEvent
                ? "Nie mamy jeszcze parkingów przy tym wydarzeniu"
                : "W tym miejscu nie mamy jeszcze parkingów"
            }
            description={
              selectedEvent
                ? `Masz miejsce w okolicy? Udostępnij je na ${selectedEvent.title} i zarób.`
                : "Masz miejsce w okolicy? Udostępnij je na czas meczu lub targów i zarób. Przesuń mapę, żeby szukać dalej."
            }
            action={
              <Button
                variant="accent"
                onClick={() => router.push(ROUTES.home)}
              >
                Policz, ile zarobisz
              </Button>
            }
          />
        ) : null}
      </div>

      <ParkingSheet
        parkingId={selectedId}
        distanceMeters={selectedDistance}
        onClose={() => setSelectedId(null)}
        onReserve={(parkingId) => router.push(ROUTES.reserve(parkingId))}
      />
    </div>
  );
}
