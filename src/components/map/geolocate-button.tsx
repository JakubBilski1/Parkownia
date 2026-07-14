"use client";

import { LocateFixed } from "lucide-react";
import { useCallback, useState } from "react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/toast";
import { useMapLibre } from "./map-view";
import type { LngLat } from "./types";

export type GeolocateButtonProps = {
  onLocated: (position: LngLat) => void;
  className?: string;
};

/**
 * "Gdzie jestem" is a driver's first move on an unfamiliar map. It flies rather
 * than jumps: the movement is what tells them the map they are looking at is
 * still the same map (MapLibre downgrades it to a jump under reduced motion).
 */
export function GeolocateButton({ onLocated, className }: GeolocateButtonProps) {
  const { map } = useMapLibre();
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
        map?.flyTo({ center: [point.lng, point.lat], zoom: 15, duration: 400 });
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
  }, [map, onLocated, toast]);

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
