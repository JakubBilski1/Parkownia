"use client";

import type { GeoJSONSource } from "maplibre-gl";
import { useEffect } from "react";
import { circleRing } from "@/components/map/geo-display";
import { useMapLibre } from "@/components/map/map-view";
import type { LngLat } from "@/components/map/types";
import type { ReachRing } from "./types";

const FILL_SRC = "reach-fill";
const FILL_LAYER = "reach-fill-layer";
const LINE_SRC = "reach-lines";
const LINE_LAYER = "reach-lines-layer";

function token(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value.length > 0 ? value : fallback;
}

/**
 * The 5/10/15-minute walking rings around the object, drawn in map units (ink,
 * not accent — the rings are context; the accent belongs to the object pin).
 * A single faint fill for the outer disk, then a line per ring. Re-adds itself
 * on styleEpoch because setStyle() (theme toggle) wipes sources and layers.
 * These are euclidean rings, deliberately NOT a routed isochrone.
 */
export function ReachRings({ center, rings }: { center: LngLat | null; rings: ReachRing[] }) {
  const { map, styleEpoch } = useMapLibre();

  useEffect(() => {
    if (!map) return;

    const remove = () => {
      for (const id of [LINE_LAYER, FILL_LAYER]) if (map.getLayer(id)) map.removeLayer(id);
      for (const id of [LINE_SRC, FILL_SRC]) if (map.getSource(id)) map.removeSource(id);
    };

    if (!center || rings.length === 0) {
      remove();
      return;
    }

    const sorted = [...rings].sort((a, b) => a.radiusMeters - b.radiusMeters);
    const largest = sorted[sorted.length - 1]!;

    const fillData: GeoJSON.Feature<GeoJSON.Polygon> = {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [circleRing(center, largest.radiusMeters)] },
    };
    const lineData: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
      type: "FeatureCollection",
      features: sorted.map((r) => ({
        type: "Feature",
        properties: { minutes: r.minutes },
        geometry: { type: "LineString", coordinates: circleRing(center, r.radiusMeters) },
      })),
    };

    const fillSource = map.getSource<GeoJSONSource>(FILL_SRC);
    const lineSource = map.getSource<GeoJSONSource>(LINE_SRC);
    if (fillSource && lineSource) {
      fillSource.setData(fillData);
      lineSource.setData(lineData);
      return;
    }

    const ink = token("--ink", "#191a1c");
    map.addSource(FILL_SRC, { type: "geojson", data: fillData });
    map.addLayer({
      id: FILL_LAYER,
      type: "fill",
      source: FILL_SRC,
      paint: { "fill-color": ink, "fill-opacity": 0.05 },
    });
    map.addSource(LINE_SRC, { type: "geojson", data: lineData });
    map.addLayer({
      id: LINE_LAYER,
      type: "line",
      source: LINE_SRC,
      paint: { "line-color": ink, "line-width": 1.25, "line-opacity": 0.35 },
    });

    return remove;
  }, [map, center, rings, styleEpoch]);

  return null;
}
