"use client";

import { useEffect, useState } from "react";
import { Button, Price, Sheet, Skeleton } from "@/components/ui";
import { ParkingCard } from "./parking-card";
import { parkingDetailSchema, type ParkingDetail } from "./types";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; parking: ParkingDetail }
  | { status: "error"; message: string };

export type ParkingSheetProps = {
  parkingId: string | null;
  onClose: () => void;
  onReserve: (parkingId: string) => void;
  /** Straight-line metres from the current reference point, if we know it. */
  distanceMeters?: number | null;
};

/**
 * Bottom sheet on a phone, side panel on a desktop — the primitive already
 * decides that. What matters here: the driver taps a pin and sees the price and
 * the entrance without the map disappearing under them.
 */
export function ParkingSheet({
  parkingId,
  onClose,
  onReserve,
  distanceMeters,
}: ParkingSheetProps) {
  const [state, setState] = useState<LoadState>({ status: "idle" });

  useEffect(() => {
    if (!parkingId) {
      setState({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading" });

    fetch(`/api/parkings/${parkingId}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const parsed = parkingDetailSchema.safeParse(await response.json());
        if (!parsed.success) throw new Error("Nieoczekiwany kształt odpowiedzi.");
        setState({ status: "ready", parking: parsed.data });
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setState({
          status: "error",
          message:
            "Nie udało się wczytać tego parkingu. Nic nie zostało zarezerwowane ani opłacone. Spróbuj ponownie albo wybierz inną pinezkę.",
        });
      });

    return () => controller.abort();
  }, [parkingId]);

  const ready = state.status === "ready" ? state.parking : null;

  return (
    <Sheet
      open={parkingId !== null}
      onClose={onClose}
      title={ready?.title ?? "Parking"}
      // The action that takes money stays pinned to the bottom edge: on a phone
      // that is the only place a thumb reaches without a second hand (Fitts).
      footer={
        ready && ready.priceGr !== null ? (
          <div className="flex items-center gap-3">
            <Price gr={ready.priceGr} size="md" className="shrink-0" />
            <Button
              variant="accent"
              size="lg"
              block
              onClick={() => onReserve(ready.id)}
            >
              Zarezerwuj
            </Button>
          </div>
        ) : undefined
      }
    >
      {state.status === "loading" || state.status === "idle" ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <span className="sr-only">Wczytujemy parking.</span>
          <Skeleton className="aspect-[4/3] max-h-40 w-full rounded-card" />
          <Skeleton className="h-6 w-3/5" />
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-24 w-full rounded-card" />
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-body text-ink">{state.message}</p>
          <Button variant="quiet" onClick={onClose}>
            Wróć do mapy
          </Button>
        </div>
      ) : null}

      {ready ? (
        <ParkingCard
          parking={ready}
          distanceMeters={distanceMeters}
          variant="sheet"
        />
      ) : null}
    </Sheet>
  );
}
