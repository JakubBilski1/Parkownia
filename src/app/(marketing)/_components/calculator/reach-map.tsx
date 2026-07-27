"use client";

import { MapPin } from "lucide-react";
import { useEffect } from "react";
import { circleBounds } from "@/components/map/geo-display";
import { MapMarker, MapView, useMapLibre } from "@/components/map/map-view";
import { cn } from "@/lib/cn";
import { ReachRings } from "./reach-rings";
import type { ReachRing, ReachVenue } from "./types";

type LngLat = { lng: number; lat: number };

function CameraToObject({ point, rings }: { point: LngLat | null; rings: ReachRing[] }) {
  const { map } = useMapLibre();
  useEffect(() => {
    if (!map || !point) return;
    const radius = Math.max(...rings.map((r) => r.radiusMeters), 400);
    const b = circleBounds(point, radius * 1.2);
    // MapLibre downgrades this to a jump under prefers-reduced-motion by itself.
    map.fitBounds(
      [
        [b.west, b.south],
        [b.east, b.north],
      ],
      { padding: 28, duration: 400, maxZoom: 15 },
    );
  }, [map, point, rings]);
  return null;
}

// The object is the active selection, so the pin is the one place the accent is
// earned here (DESIGN_PRINCIPLES §4: "aktywna pinezka").
function ObjectPin() {
  return (
    <span className="block" aria-hidden="true">
      <MapPin
        className="h-9 w-9 fill-accent text-accent-ink drop-shadow-[0_2px_4px_rgb(0_0_0/0.35)]"
        strokeWidth={1.75}
      />
    </span>
  );
}

function VenuePin({ label, minutes, inReach }: { label: string; minutes: number; inReach: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-pill border px-2 py-0.5 text-ui font-semibold shadow-card",
        inReach ? "border-ink bg-surface text-ink" : "border-line bg-surface text-muted",
      )}
    >
      {label}
      <span className="font-normal tabular-nums text-muted">· {minutes} min</span>
    </span>
  );
}

function venueLabel(venue: ReachVenue): string {
  if (venue.key === "ENEA") return "Enea Stadion";
  if (venue.key === "MTP") return "MTP";
  return venue.name;
}

export function ReachMap({
  point,
  rings,
  venues,
  onPointPick,
}: {
  point: LngLat | null;
  rings: ReachRing[];
  venues: ReachVenue[];
  onPointPick: (p: LngLat) => void;
}) {
  return (
    <div className="relative h-[320px] w-full overflow-hidden rounded-card border border-line shadow-card sm:h-[400px] lg:h-[460px]">
      <MapView
        onViewportChange={() => {}}
        onReady={(map) => {
          map.on("click", (event) => {
            onPointPick({ lat: event.lngLat.lat, lng: event.lngLat.lng });
          });
        }}
      >
        <CameraToObject point={point} rings={rings} />
        <ReachRings center={point} rings={rings} />
        {point ? (
          <MapMarker lng={point.lng} lat={point.lat} zIndex={4}>
            <ObjectPin />
          </MapMarker>
        ) : null}
        {venues.map((venue) => (
          <MapMarker key={venue.key} lng={venue.lng} lat={venue.lat} zIndex={3}>
            <VenuePin label={venueLabel(venue)} minutes={venue.walkMinutes} inReach={venue.inReach} />
          </MapMarker>
        ))}
      </MapView>

      {!point ? (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center p-4">
          <p className="rounded-pill bg-surface px-3 py-1.5 text-ui text-ink shadow-float">
            Wpisz adres albo kliknij miejsce na mapie
          </p>
        </div>
      ) : null}
    </div>
  );
}
