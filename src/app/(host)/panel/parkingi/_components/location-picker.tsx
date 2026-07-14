"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import { LoaderCircle, MapPin, Search, SquareArrowOutUpRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MapMarker, MapView } from "@/components/map/map-view";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/cn";

export type PickerPoint = { lat: number; lng: number };

type GeocodeItem = {
  label: string;
  lat: number;
  lng: number;
};

export type LocationPickerProps = {
  value: PickerPoint | null;
  onChange: (point: PickerPoint) => void;
  /** Fired when the host picks a search result or asks for the pin's address. */
  onAddress?: (address: string) => void;
  /** The other point, drawn for context only: the entrance is not the lot. */
  contextPoint?: PickerPoint | null;
  contextLabel?: string;
  searchable?: boolean;
  /** Accent is reserved for the active pin — the entrance pin is neutral ink. */
  tone?: "accent" | "ink";
  hint: string;
  className?: string;
};

export function LocationPicker({
  value,
  onChange,
  onAddress,
  contextPoint,
  contextLabel,
  searchable = false,
  tone = "accent",
  hint,
  className,
}: LocationPickerProps) {
  const mapRef = useRef<MapLibreMap | null>(null);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const onReady = useCallback((map: MapLibreMap) => {
    mapRef.current = map;
    map.on("click", (event) => {
      changeRef.current({ lat: event.lngLat.lat, lng: event.lngLat.lng });
    });
  }, []);

  // Recentres only when the point itself moves (search hit, reverse geocode, a tap
  // on the map) — not on every render, or the map would fight the host's panning.
  const lat = value?.lat;
  const lng = value?.lng;

  useEffect(() => {
    if (lat === undefined || lng === undefined || !mapRef.current) return;
    mapRef.current.easeTo({ center: [lng, lat], duration: 300 });
  }, [lat, lng]);

  async function search() {
    const trimmed = query.trim();
    if (trimmed.length < 3) return;

    setSearching(true);
    setSearchError(null);

    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
      if (!response.ok) {
        setSearchError("Wyszukiwarka adresów nie odpowiada. Wskaż miejsce na mapie.");
        setResults([]);
        return;
      }
      const payload: { items: GeocodeItem[] } = await response.json();
      setResults(payload.items);
      if (payload.items.length === 0) {
        setSearchError("Nie znaleźliśmy tego adresu. Wskaż miejsce na mapie.");
      }
    } catch {
      setSearchError("Brak połączenia. Wskaż miejsce na mapie.");
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function choose(item: GeocodeItem) {
    onChange({ lat: item.lat, lng: item.lng });
    onAddress?.(item.label);
    setResults([]);
    setQuery(item.label);
  }

  async function addressFromPin() {
    if (!value || !onAddress) return;
    setSearching(true);
    try {
      const response = await fetch(`/api/geocode?lat=${value.lat}&lng=${value.lng}`);
      if (!response.ok) return;
      const payload: { items: GeocodeItem[] } = await response.json();
      const first = payload.items[0];
      if (first) {
        onAddress(first.label);
        setQuery(first.label);
      }
    } catch {
      setSearchError("Brak połączenia. Wpisz adres ręcznie.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* A <div>, not a <form>. The picker is rendered INSIDE the parking form, and
          a nested <form> is invalid HTML: the parser drops the inner one, the server
          and client trees stop matching, and React tears the page down and rebuilds
          it (hydration failure) — taking the half-typed draft with it. It also meant
          Enter in the address box submitted the PARKING to moderation.
          Enter is handled here explicitly, so the behaviour is unchanged. */}
      {searchable ? (
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              void search();
            }}
            placeholder="np. Bułgarska 17, Poznań"
            autoComplete="street-address"
            aria-label="Szukaj adresu"
            enterKeyHint="search"
          />
          <Button
            type="button"
            onClick={() => void search()}
            loading={searching}
            aria-label="Szukaj adresu"
          >
            <Search size={18} aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      {results.length > 0 ? (
        <ul className="flex flex-col gap-1 rounded-card border border-line bg-surface p-1">
          {results.map((item) => (
            <li key={`${item.lat},${item.lng}`}>
              <button
                type="button"
                onClick={() => choose(item)}
                className="flex min-h-touch w-full items-center gap-2 rounded-button px-3 py-2 text-left text-ui text-ink transition-colors duration-micro ease-out hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <MapPin size={16} aria-hidden="true" className="shrink-0 text-muted" />
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative h-64 overflow-hidden rounded-card border border-line">
        <MapView onViewportChange={() => undefined} onReady={onReady}>
          {value ? (
            <MapMarker lng={value.lng} lat={value.lat} zIndex={2}>
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-pill border-2 shadow-float",
                  tone === "accent"
                    ? "border-accent-ink bg-accent text-accent-ink"
                    : "border-surface bg-ink text-bg",
                )}
              >
                <MapPin size={18} aria-hidden="true" />
              </span>
            </MapMarker>
          ) : null}

          {contextPoint ? (
            <MapMarker lng={contextPoint.lng} lat={contextPoint.lat} zIndex={1}>
              <span
                title={contextLabel}
                className="flex h-7 w-7 items-center justify-center rounded-pill border border-line bg-surface text-muted"
              >
                <SquareArrowOutUpRight size={14} aria-hidden="true" />
              </span>
            </MapMarker>
          ) : null}
        </MapView>

        {searching ? (
          <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-pill bg-surface text-muted shadow-card">
            <LoaderCircle size={16} aria-hidden="true" className="animate-spin" />
          </span>
        ) : null}
      </div>

      <p className="text-ui text-muted">{hint}</p>

      {searchError ? (
        <p role="alert" className="text-ui text-danger">
          {searchError}
        </p>
      ) : null}

      {value ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="num text-ui text-muted">
            {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          </span>
          {onAddress ? (
            <Button size="sm" variant="ghost" onClick={addressFromPin} disabled={searching}>
              Uzupełnij adres z pinezki
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
