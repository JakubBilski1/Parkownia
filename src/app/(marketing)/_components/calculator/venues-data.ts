import { listVenueAnchors } from "@/modules/leads/service";
import type { VenueAnchor } from "./types";

/**
 * Kept apart from the client island for the same reason as fixtures-data.ts:
 * this module reaches `@/db`, which pulls in `postgres`, which imports `net`.
 * Anything a client component imports must not touch it.
 *
 * A database hiccup must not take the calculator down with it — the map still
 * works, the pins and the two focus buttons simply are not there.
 */
export async function loadVenueAnchors(): Promise<VenueAnchor[]> {
  try {
    return await listVenueAnchors();
  } catch (error) {
    console.error("[landing] venues failed:", error instanceof Error ? error.message : error);
    return [];
  }
}
