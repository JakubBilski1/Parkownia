"use client";

import Supercluster from "supercluster";
import { useMemo } from "react";
import {
  estimateWalk,
  isWalkable,
  WALK_PLAUSIBLE_MAX_MINUTES,
  WALK_SPEED_M_PER_MIN,
} from "@/lib/format";
import { straightLineMeters } from "./geo-display";
import { MapMarker, useMapLibre, type Viewport } from "./map-view";
import { ClusterBubble, PricePin } from "./price-pin";
import type { LngLat, MapPin } from "./types";

/** Wider than the 60 px pin: two pins may never be rendered edge to edge. */
const CLUSTER_RADIUS_PX = 76;
const CLUSTER_MAX_ZOOM = 17;

const PIN_WIDTH_PX = 64;
const PIN_HEIGHT_PX = 48;
const LIFT_STEPS = [0, 22, 44, 66];

type PinProps = { pinId: string; priceGr: number };
type ClusterProps = { minPriceGr: number };

type Placed = {
  pin: MapPin;
  lift: number;
};

/**
 * Minutes on the pin, or nothing.
 *
 * Nothing is a real answer here. With no event picked the reference is the
 * driver's own position, so somebody opening the map from home 21 km away was
 * shown "265 min" — correct arithmetic, useless on a 60 px label, and it reads
 * as a broken number rather than as "you are far away". Past the plausible walk
 * the pin drops the claim and shows the price alone; the sheet, which has room
 * for a sentence, says the distance instead.
 */
function walkMinutes(pin: MapPin, reference: LngLat | null): number | null {
  if (typeof pin.walkMeters === "number") {
    const minutes = Math.max(1, Math.round(pin.walkMeters / WALK_SPEED_M_PER_MIN));
    return minutes <= WALK_PLAUSIBLE_MAX_MINUTES ? minutes : null;
  }
  if (!reference) return null;
  const meters = straightLineMeters(reference, { lng: pin.lng, lat: pin.lat });
  return isWalkable(meters) ? estimateWalk(meters).minutes : null;
}

/**
 * Forty pins under a stadium have to stay readable. Two mechanisms, in order:
 * clustering (supercluster, radius wider than the pin) and then a lift pass —
 * a pin whose label still collides grows a stem and rides above its neighbour.
 * The tip never moves: it points at the entrance, and a pin that lied about
 * where to drive would be worse than a pin that overlaps.
 */
function liftOverlaps(
  pins: MapPin[],
  project: (point: LngLat) => { x: number; y: number },
): Placed[] {
  const anchors = pins
    .map((pin) => ({ pin, point: project({ lng: pin.lng, lat: pin.lat }) }))
    .sort((a, b) => a.point.y - b.point.y);

  const boxes: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const placed: Placed[] = [];

  for (const { pin, point } of anchors) {
    let chosen = 0;
    for (const lift of LIFT_STEPS) {
      const box = {
        x1: point.x - PIN_WIDTH_PX / 2,
        x2: point.x + PIN_WIDTH_PX / 2,
        y1: point.y - lift - PIN_HEIGHT_PX,
        y2: point.y - lift,
      };
      const collides = boxes.some(
        (other) =>
          box.x1 < other.x2 && box.x2 > other.x1 && box.y1 < other.y2 && box.y2 > other.y1,
      );
      if (!collides) {
        boxes.push(box);
        chosen = lift;
        break;
      }
      chosen = lift;
    }
    placed.push({ pin, lift: chosen });
  }

  return placed;
}

export type ClusterLayerProps = {
  pins: MapPin[];
  viewport: Viewport | null;
  selectedId: string | null;
  onSelect: (pinId: string) => void;
  /** Venue or the driver's own position — the point walk times are measured to. */
  reference: LngLat | null;
};

export function ClusterLayer({
  pins,
  viewport,
  selectedId,
  onSelect,
  reference,
}: ClusterLayerProps) {
  const { map } = useMapLibre();

  const index = useMemo(() => {
    const cluster = new Supercluster<PinProps, ClusterProps>({
      radius: CLUSTER_RADIUS_PX,
      maxZoom: CLUSTER_MAX_ZOOM,
      minPoints: 2,
      map: (props) => ({ minPriceGr: props.priceGr }),
      reduce: (accumulated, props) => {
        accumulated.minPriceGr = Math.min(accumulated.minPriceGr, props.minPriceGr);
      },
    });

    cluster.load(
      pins.map((pin) => ({
        type: "Feature" as const,
        properties: { pinId: pin.id, priceGr: pin.priceGr },
        geometry: { type: "Point" as const, coordinates: [pin.lng, pin.lat] },
      })),
    );

    return cluster;
  }, [pins]);

  const byId = useMemo(() => new Map(pins.map((pin) => [pin.id, pin])), [pins]);

  const features = useMemo(() => {
    if (!viewport) return [];
    const { west, south, east, north } = viewport.bbox;
    return index.getClusters([west, south, east, north], Math.round(viewport.zoom));
  }, [index, viewport]);

  const { clusters, singles } = useMemo(() => {
    const clusterFeatures: Array<{
      id: number;
      lng: number;
      lat: number;
      count: number;
      minPriceGr: number | null;
    }> = [];
    const singlePins: MapPin[] = [];

    for (const feature of features) {
      const [lng, lat] = feature.geometry.coordinates;
      if (lng === undefined || lat === undefined) continue;

      if ("cluster" in feature.properties && feature.properties.cluster) {
        clusterFeatures.push({
          id: feature.properties.cluster_id,
          lng,
          lat,
          count: feature.properties.point_count,
          minPriceGr: feature.properties.minPriceGr ?? null,
        });
        continue;
      }

      const pin = byId.get((feature.properties as PinProps).pinId);
      if (pin) singlePins.push(pin);
    }

    return { clusters: clusterFeatures, singles: singlePins };
  }, [features, byId]);

  const placed = useMemo(() => {
    if (!map) return singles.map((pin) => ({ pin, lift: 0 }));
    return liftOverlaps(singles, (point) => map.project([point.lng, point.lat]));
    // viewport is a dependency the linter cannot see: map.project() reads the
    // live camera, and the pixel gaps between pins change with every zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, singles, viewport]);

  return (
    <>
      {clusters.map((cluster) => (
        <MapMarker key={`c-${cluster.id}`} lng={cluster.lng} lat={cluster.lat}>
          <ClusterBubble
            count={cluster.count}
            fromPriceGr={cluster.minPriceGr}
            onSelect={() => {
              if (!map) return;
              const zoom = Math.min(
                index.getClusterExpansionZoom(cluster.id),
                map.getMaxZoom(),
              );
              map.easeTo({ center: [cluster.lng, cluster.lat], zoom, duration: 320 });
            }}
          />
        </MapMarker>
      ))}

      {placed.map(({ pin, lift }) => {
        const selected = pin.id === selectedId;
        return (
          <MapMarker
            key={pin.id}
            lng={pin.lng}
            lat={pin.lat}
            zIndex={selected ? 30 : 10}
          >
            <PricePin
              priceGr={pin.priceGr}
              walkMinutes={walkMinutes(pin, reference)}
              isCovered={pin.isCovered}
              selected={selected}
              liftPx={lift}
              onSelect={() => onSelect(pin.id)}
            />
          </MapMarker>
        );
      })}
    </>
  );
}
