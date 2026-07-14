import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { WeeklySchedule } from "@/db/types";
import { APP_TIME_ZONE } from "@/lib/format";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const DAY_MS = 86_400_000;

function dateKey(instant: Date): string {
  return formatInTimeZone(instant, APP_TIME_ZONE, "yyyy-MM-dd");
}

function weekdayKey(key: string): (typeof DAY_KEYS)[number] {
  const index = new Date(`${key}T12:00:00Z`).getUTCDay();
  return DAY_KEYS[index] as (typeof DAY_KEYS)[number];
}

function nextDateKey(key: string): string {
  return new Date(new Date(`${key}T00:00:00Z`).getTime() + DAY_MS).toISOString().slice(0, 10);
}

/**
 * "17:00" on a local date becomes an instant through the zone, not through
 * arithmetic on a UTC timestamp — otherwise the two DST switch days would drift
 * by an hour. "24:00" is midnight of the following local day.
 */
function slotInstant(key: string, hhmm: string): Date | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (minutes > 59 || hours > 24 || (hours === 24 && minutes !== 0)) return null;

  if (hours === 24) {
    return fromZonedTime(`${nextDateKey(key)}T00:00:00`, APP_TIME_ZONE);
  }
  const pad = (value: number) => value.toString().padStart(2, "0");
  return fromZonedTime(`${key}T${pad(hours)}:${pad(minutes)}:00`, APP_TIME_ZONE);
}

type Interval = { start: number; end: number };

function scheduleIntervals(schedule: WeeklySchedule, from: Date, to: Date): Interval[] {
  const keys = new Set<string>();
  // A local day either side of the window: a Friday 17:00–24:00 slot has to be
  // able to join Saturday's, and a booking can start before its own local day.
  for (
    let cursor = from.getTime() - DAY_MS;
    cursor <= to.getTime() + DAY_MS;
    cursor += DAY_MS
  ) {
    keys.add(dateKey(new Date(cursor)));
  }
  keys.add(dateKey(new Date(to.getTime() + DAY_MS)));

  const intervals: Interval[] = [];
  for (const key of keys) {
    const slots = schedule[weekdayKey(key)] ?? [];
    for (const slot of slots) {
      const start = slotInstant(key, slot.from);
      const end = slotInstant(key, slot.to);
      if (!start || !end || end.getTime() <= start.getTime()) continue;
      intervals.push({ start: start.getTime(), end: end.getTime() });
    }
  }

  intervals.sort((a, b) => a.start - b.start);

  const merged: Interval[] = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    // `>=` and not `>`: touching slots (Fri …24:00 + Sat 00:00…) are one window.
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

/** A booking window must sit entirely inside one continuous declared slot. */
export function isCoveredBySchedule(
  schedule: WeeklySchedule | null | undefined,
  startsAt: Date,
  endsAt: Date,
): boolean {
  if (!schedule) return false;
  const start = startsAt.getTime();
  const end = endsAt.getTime();
  return scheduleIntervals(schedule, startsAt, endsAt).some(
    (interval) => interval.start <= start && interval.end >= end,
  );
}
