"use client";

import { MapPin } from "lucide-react";
import { useEffect } from "react";
import { circleBounds } from "@/components/map/geo-display";
import { MapMarker, MapView, useMapLibre } from "@/components/map/map-view";
import { cn } from "@/lib/cn";
import { ReachRings } from "./reach-rings";
import type { ReachRing, ReachVenue, VenueAnchor } from "./types";

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

/**
 * The venues are marked in the neutral selected ink, never in the accent: the
 * accent belongs to the spot the visitor picked, and two reds on one map would
 * make their own pin compete with the scenery. Solid ink on the paper map is
 * the strongest mark the system has that is not the accent — the venue reads
 * as a fixed landmark, their pin as the thing that moves.
 */
function VenuePin({
  label,
  minutes,
  inReach,
}: {
  label: string;
  minutes: number | null;
  inReach: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-pill px-2 py-0.5 text-ui font-semibold shadow-float",
        "bg-[var(--map-paper-ink)] text-[color:var(--map-paper-surface)]",
        // Out of reach: the landmark is still there, it just stops claiming the
        // visitor's attention.
        minutes !== null && !inReach && "opacity-70",
      )}
    >
      {label}
      {minutes !== null ? (
        <span className="font-normal tabular-nums opacity-80">· {minutes} min</span>
      ) : null}
    </span>
  );
}

function venueLabel(key: VenueAnchor["key"], name: string): string {
  if (key === "ENEA") return "Enea Stadion";
  if (key === "MTP") return "MTP";
  return name;
}

/**
 * Two shortcuts to the places the whole calculation is about. An owner opens
 * this map on a city they know and still has to find the stadium in it — these
 * take them there in one tap, and the pins tell them what they are looking at
 * once they arrive.
 */
function VenueFocus({ anchors }: { anchors: VenueAnchor[] }) {
  const { map } = useMapLibre();
  if (anchors.length === 0) return null;

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap gap-2">
      {anchors.map((anchor) => (
        <button
          key={anchor.key}
          type="button"
          onClick={() =>
            // A flight, not a jump: it is what tells them this is still the same
            // map they were looking at. MapLibre downgrades it under
            // prefers-reduced-motion on its own.
            map?.flyTo({ center: [anchor.lng, anchor.lat], zoom: 15, duration: 700 })
          }
          className={cn(
            "press pointer-events-auto inline-flex min-h-touch items-center gap-1.5 rounded-pill px-3 py-1.5",
            "border text-ui font-semibold shadow-float",
            // Paper chrome on a paper map, like the pins — not page-theme chrome.
            "border-[color:var(--map-paper-line)] bg-[var(--map-paper-surface)] text-[color:var(--map-paper-ink)]",
            "transition-opacity duration-micro ease-out hover-hover:hover:opacity-90",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          )}
        >
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-pill bg-[var(--map-paper-ink)]"
          />
          {venueLabel(anchor.key, anchor.name)}
        </button>
      ))}
    </div>
  );
}

export function ReachMap({
  point,
  rings,
  venues,
  anchors,
  onPointPick,
}: {
  point: LngLat | null;
  rings: ReachRing[];
  venues: ReachVenue[];
  /** Always known — the landmarks exist before anybody picks anything. */
  anchors: VenueAnchor[];
  onPointPick: (p: LngLat) => void;
}) {
  // Distances arrive only once a point is picked; the landmark itself does not
  // wait for that. Keyed by venue so a pin gains its "· 7 min" in place rather
  // than being replaced by a second pin.
  const measured = new Map(venues.map((venue) => [venue.key, venue]));
  const pins = anchors.map((anchor) => {
    const reach = measured.get(anchor.key);
    return {
      key: anchor.key,
      label: venueLabel(anchor.key, anchor.name),
      lat: reach?.lat ?? anchor.lat,
      lng: reach?.lng ?? anchor.lng,
      minutes: reach?.walkMinutes ?? null,
      inReach: reach?.inReach ?? true,
    };
  });

  return (
    <div className="relative h-[320px] w-full overflow-hidden rounded-card border border-line shadow-card sm:h-[400px] lg:h-[460px]">
      <MapView
        tone="paper"
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
        {pins.map((pin) => (
          <MapMarker key={pin.key} lng={pin.lng} lat={pin.lat} zIndex={3}>
            <VenuePin label={pin.label} minutes={pin.minutes} inReach={pin.inReach} />
          </MapMarker>
        ))}
        <VenueFocus anchors={anchors} />
      </MapView>

      {!point ? (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center p-4">
          <p className="rounded-pill bg-[var(--map-paper-surface)] px-3 py-1.5 text-ui text-[color:var(--map-paper-ink)] shadow-float">
            Wpisz adres albo kliknij miejsce na mapie
          </p>
        </div>
      ) : null}
    </div>
  );
}
