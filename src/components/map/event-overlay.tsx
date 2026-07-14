"use client";

import type { GeoJSONSource } from "maplibre-gl";
import { useEffect } from "react";
import { circleRing } from "./geo-display";
import { useMapLibre } from "./map-view";
import type { LngLat } from "./types";

const SOURCE_ID = "ps-event-radius";
const FILL_LAYER_ID = "ps-event-radius-fill";
const LINE_LAYER_ID = "ps-event-radius-line";

function token(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value.length > 0 ? value : fallback;
}

export type EventOverlayProps = {
  center: LngLat | null;
  radiusMeters: number;
};

/**
 * The search radius of an event, drawn in map units so it stays geographically
 * honest at every zoom. Ink, not accent: the ring is context, not a choice —
 * the accent belongs to the pin the driver actually picks.
 */
export function EventOverlay({ center, radiusMeters }: EventOverlayProps) {
  const { map, styleEpoch } = useMapLibre();

  useEffect(() => {
    if (!map) return;

    const remove = () => {
      if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
      if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };

    if (!center) {
      remove();
      return;
    }

    const data: GeoJSON.Feature<GeoJSON.Polygon> = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [circleRing(center, radiusMeters)],
      },
    };

    const source = map.getSource<GeoJSONSource>(SOURCE_ID);
    if (source) {
      source.setData(data);
      return;
    }

    const ink = token("--ink", "#191a1c");

    map.addSource(SOURCE_ID, { type: "geojson", data });
    map.addLayer({
      id: FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      paint: { "fill-color": ink, "fill-opacity": 0.06 },
    });
    map.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      paint: { "line-color": ink, "line-width": 1.5, "line-opacity": 0.35 },
    });

    return remove;
    // styleEpoch: setStyle() wipes every source and layer, so they are re-added.
  }, [map, center, radiusMeters, styleEpoch]);

  return null;
}
