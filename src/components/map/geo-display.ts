import type { Bbox, LngLat } from "./types";

const EARTH_RADIUS_M = 6_371_000;

/**
 * Presentation-only distance. Geo *queries* run in PostGIS on the GiST index —
 * this never filters anything, it only labels a pin that the server already
 * selected. The map endpoint returns no distance (it has no reference point),
 * so when the driver picks an event we measure to the venue here and every
 * string built from it stays hedged ("ok.", straight line, not a walked route).
 */
export function straightLineMeters(a: LngLat, b: LngLat): number {
  const toRad = Math.PI / 180;
  const lat1 = a.lat * toRad;
  const lat2 = b.lat * toRad;
  const dLat = (b.lat - a.lat) * toRad;
  const dLng = (b.lng - a.lng) * toRad;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Circle as a polygon ring — MapLibre draws the event radius in map units, so
 *  it stays geographically true at every zoom instead of being a fixed-px halo. */
export function circleRing(center: LngLat, radiusMeters: number, steps = 96): number[][] {
  const ring: number[][] = [];
  const latRad = (center.lat * Math.PI) / 180;
  const dLat = (radiusMeters / EARTH_RADIUS_M) * (180 / Math.PI);
  const dLng = dLat / Math.max(Math.cos(latRad), 1e-6);

  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * 2 * Math.PI;
    ring.push([
      center.lng + dLng * Math.cos(angle),
      center.lat + dLat * Math.sin(angle),
    ]);
  }
  return ring;
}

/** Bounds that contain the whole event radius — what the camera should frame. */
export function circleBounds(center: LngLat, radiusMeters: number): Bbox {
  const dLat = (radiusMeters / EARTH_RADIUS_M) * (180 / Math.PI);
  const dLng = dLat / Math.max(Math.cos((center.lat * Math.PI) / 180), 1e-6);

  return {
    west: center.lng - dLng,
    south: center.lat - dLat,
    east: center.lng + dLng,
    north: center.lat + dLat,
  };
}

export function bboxKey(bbox: Bbox, precision = 4): string {
  return [bbox.west, bbox.south, bbox.east, bbox.north]
    .map((value) => value.toFixed(precision))
    .join(",");
}

export function bboxToParam(bbox: Bbox): string {
  return `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
}
