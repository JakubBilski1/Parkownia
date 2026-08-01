"use client";

import { LocateFixed } from "lucide-react";
import { useCallback, useState } from "react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/toast";
import type { LngLat } from "./types";

export type GeolocateButtonProps = {
  onLocated: (position: LngLat) => void;
  className?: string;
};

/**
 * "Gdzie jestem" is a driver's first move on an unfamiliar map.
 *
 * The button does not touch the map itself, and that is the fix rather than a
 * style choice. It used to call useMapLibre() and fly the map — but it is
 * rendered in the bottom control strip, a SIBLING of <MapView>, so it sat
 * outside MapContext.Provider and read the default `{ map: null }`. The
 * optional chain on `map?.flyTo` then swallowed it: geolocation succeeded, the
 * pins recalculated their distances from the new position, and the map never
 * moved. It looked precisely like a dead button, and was reported as one.
 *
 * Moving the camera belongs to whoever owns the map instance, so the position
 * goes up and the caller decides.
 */
export function GeolocateButton({ onLocated, className }: GeolocateButtonProps) {
  const { toast } = useToast();
  const [locating, setLocating] = useState(false);

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      toast({
        tone: "error",
        message: "Ta przeglądarka nie udostępnia lokalizacji.",
        detail: "Przesuń mapę ręcznie albo wpisz adres w wyszukiwarce.",
      });
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const point = {
          lng: position.coords.longitude,
          lat: position.coords.latitude,
        };
        onLocated(point);
      },
      (error) => {
        setLocating(false);
        toast({
          tone: "error",
          message:
            error.code === error.PERMISSION_DENIED
              ? "Nie mamy zgody na dostęp do Twojej lokalizacji."
              : "Nie udało się ustalić Twojej lokalizacji.",
          detail:
            error.code === error.PERMISSION_DENIED
              ? "Włącz lokalizację dla tej strony w ustawieniach przeglądarki albo przesuń mapę ręcznie."
              : "Sygnał GPS bywa słaby pod stadionem. Przesuń mapę ręcznie.",
        });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  }, [onLocated, toast]);

  return (
    <button
      type="button"
      onClick={locate}
      aria-label="Pokaż moją lokalizację"
      aria-busy={locating || undefined}
      className={cn(
        "press inline-flex h-touch w-touch items-center justify-center rounded-pill border border-line bg-surface text-ink shadow-float",
        "transition-colors duration-micro ease-out hover:bg-surface-2",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        className,
      )}
    >
      {locating ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-pill border-2 border-current border-t-transparent"
        />
      ) : (
        <LocateFixed size={20} aria-hidden="true" />
      )}
    </button>
  );
}
