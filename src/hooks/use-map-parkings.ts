"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { bboxKey, bboxToParam } from "@/components/map/geo-display";
import {
  filtersToQuery,
  mapPinsResponseSchema,
  type Bbox,
  type MapFilters,
  type MapPin,
} from "@/components/map/types";

const DEBOUNCE_MS = 300;

export type MapParkingsState = {
  pins: MapPin[];
  /** First load of a viewport that has nothing to show yet — draw skeletons. */
  isInitialLoading: boolean;
  /** A refresh while pins from the previous viewport are still on screen. */
  isRefreshing: boolean;
  error: string | null;
  retry: () => void;
};

/**
 * Only what is inside the viewport is ever fetched, and only 300 ms after the
 * map stops moving: a pan across Poznań would otherwise fire a query per frame.
 * Requests are aborted when superseded, so a slow response for an old bbox can
 * never overwrite a fresh one.
 */
export function useMapParkings(
  bbox: Bbox | null,
  filters: MapFilters,
): MapParkingsState {
  const [pins, setPins] = useState<MapPin[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const key = bbox ? bboxKey(bbox) : null;
  const filterKey = JSON.stringify(filtersToQuery(filters));

  // The effect depends on serialised keys, not on the object identities: a new
  // bbox object with the same numbers must not trigger another request.
  const bboxRef = useRef<Bbox | null>(bbox);
  bboxRef.current = bbox;
  const filtersRef = useRef<MapFilters>(filters);
  filtersRef.current = filters;

  useEffect(() => {
    if (!key) return;

    const timer = setTimeout(() => {
      const current = bboxRef.current;
      if (!current) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const params = new URLSearchParams({
        bbox: bboxToParam(current),
        ...filtersToQuery(filtersRef.current),
      });

      setLoading(true);
      setError(null);

      fetch(`/api/map/parkings?${params.toString()}`, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const json: unknown = await response.json();
          const parsed = mapPinsResponseSchema.safeParse(json);
          if (!parsed.success) {
            throw new Error("Nieoczekiwany kształt odpowiedzi.");
          }
          setPins(parsed.data.items);
          setLoadedOnce(true);
          setLoading(false);
        })
        .catch((cause: unknown) => {
          if (cause instanceof DOMException && cause.name === "AbortError") return;
          setError(
            "Nie udało się pobrać parkingów. Nic nie zostało pobrane z Twojego konta. Sprawdź połączenie i spróbuj ponownie.",
          );
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [key, filterKey, attempt]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return {
    pins,
    isInitialLoading: loading && !loadedOnce,
    isRefreshing: loading && loadedOnce,
    error,
    retry,
  };
}
