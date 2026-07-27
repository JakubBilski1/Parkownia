import { listUpcomingEvents } from "@/modules/events/service";
import type { FixturesData } from "./fixtures";

/** How many rows the panel shows before it starts counting the rest. */
const ROWS = 5;

/**
 * Kept apart from the panel that renders it, and not by accident: this module
 * reaches `@/db`, which pulls in `postgres`, which imports `net`. Any client
 * component that imported the panel from the same file would drag all of that
 * into the browser bundle and fail the build with "Can't resolve 'net'".
 *
 * Loaded by the hero rather than by the panel, because an empty result has to
 * change the LAYOUT, not just blank a column: a server component returning null
 * still occupies its grid cell, which on a machine with no database left the
 * headline squeezed into half a screen next to a hole.
 *
 * An acquisition page must not 500 on a database hiccup either, so a failure is
 * logged and reported as "no fixtures" — the hero stands on its own without it.
 */
export async function loadFixtures(): Promise<FixturesData | null> {
  try {
    const events = await listUpcomingEvents(40);
    if (events.length === 0) return null;
    return {
      rows: events.slice(0, ROWS).map((event) => ({
        id: event.id,
        title: event.title,
        venue: event.venue.name,
        category: event.category,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
      })),
      rest: Math.max(0, events.length - ROWS),
    };
  } catch (error) {
    console.error("[landing] fixtures failed:", error instanceof Error ? error.message : error);
    return null;
  }
}
