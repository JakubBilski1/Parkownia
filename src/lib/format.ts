import { differenceInCalendarDays, parseISO } from "date-fns";
import { pl } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";

export const APP_TIME_ZONE = "Europe/Warsaw";

/**
 * Walking estimate is a detoured straight line, not a routed path. Real routing
 * (OSRM/Valhalla) lands post-MVP; until then every string this module produces
 * must stay hedged ("ok.") so the UI never claims precision it does not have.
 */
export const WALK_DETOUR_FACTOR = 1.3;
export const WALK_SPEED_M_PER_MIN = 80;

type Money = { amount: string; currency: string };

function groszToParts(gr: number): Money {
  const rounded = Math.round(gr);
  const negative = rounded < 0;
  const abs = Math.abs(rounded);
  const zloty = Math.floor(abs / 100);
  const grosz = abs % 100;

  const zlotyText = zloty.toLocaleString("pl-PL").replace(/ /g, " ");
  const amount =
    grosz === 0
      ? `${zlotyText}`
      : `${zlotyText},${grosz.toString().padStart(2, "0")}`;

  return { amount: negative ? `-${amount}` : amount, currency: "zł" };
}

/** Money lives in the database as integer grosze. "3500" -> "35 zł". */
export function formatMoney(gr: number): string {
  const { amount, currency } = groszToParts(gr);
  return `${amount} ${currency}`;
}

/** Same value, split so the currency can be typeset apart from the number. */
export function formatMoneyParts(gr: number): Money {
  return groszToParts(gr);
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/** "25.07.2026, 20:00" — UTC in the database, Europe/Warsaw on screen. */
export function formatDateTimePL(value: Date | string | number): string {
  return formatInTimeZone(toDate(value), APP_TIME_ZONE, "dd.MM.yyyy, HH:mm", {
    locale: pl,
  });
}

/** "sob., 25 lipca" — for event lists, where the year is implied. */
export function formatDatePL(value: Date | string | number): string {
  return formatInTimeZone(toDate(value), APP_TIME_ZONE, "EEE, d MMMM", {
    locale: pl,
  });
}

/** "20:00" */
export function formatTimePL(value: Date | string | number): string {
  return formatInTimeZone(toDate(value), APP_TIME_ZONE, "HH:mm", { locale: pl });
}

/** "20:00 – 23:30" (same day) or "25.07, 20:00 – 26.07, 01:00". */
export function formatTimeRangePL(
  start: Date | string | number,
  end: Date | string | number,
): string {
  const startDate = toDate(start);
  const endDate = toDate(end);
  const sameDay =
    formatInTimeZone(startDate, APP_TIME_ZONE, "yyyy-MM-dd") ===
    formatInTimeZone(endDate, APP_TIME_ZONE, "yyyy-MM-dd");

  if (sameDay) {
    return `${formatTimePL(startDate)} – ${formatTimePL(endDate)}`;
  }
  return `${formatInTimeZone(startDate, APP_TIME_ZONE, "dd.MM, HH:mm")} – ${formatInTimeZone(
    endDate,
    APP_TIME_ZONE,
    "dd.MM, HH:mm",
  )}`;
}

/** "dd" in Warsaw — the day of the month, on its own, for a date's typography. */
export function formatDayOfMonthPL(value: Date | string | number): string {
  return formatInTimeZone(toDate(value), APP_TIME_ZONE, "dd", { locale: pl });
}

/**
 * "trwa teraz" / "dziś" / "jutro" / "za 9 dni" — how far off an event is.
 *
 * Counted in CALENDAR days in Europe/Warsaw, not in elapsed hours: at 23:00 an
 * event starting in two hours is "jutro", and 25 hours out can still be "jutro"
 * as well. Both sides collapse to a plain yyyy-MM-dd in Warsaw before they are
 * compared, so a DST switch in between cannot shift the answer by a day.
 *
 * `endsAt` is not decoration — listUpcomingEvents keeps events whose endsAt is
 * still ahead, so the soonest one can be a match already under way.
 */
export function formatEventCountdownPL(
  startsAt: Date | string | number,
  endsAt: Date | string | number,
  now: Date | string | number = new Date(),
): string {
  const start = toDate(startsAt);
  const end = toDate(endsAt);
  const current = toDate(now);

  if (current.getTime() >= end.getTime()) return "zakończone";
  if (current.getTime() >= start.getTime()) return "trwa teraz";

  const days = differenceInCalendarDays(
    parseISO(formatInTimeZone(start, APP_TIME_ZONE, "yyyy-MM-dd")),
    parseISO(formatInTimeZone(current, APP_TIME_ZONE, "yyyy-MM-dd")),
  );

  if (days <= 0) return "dziś";
  if (days === 1) return "jutro";
  return `za ${days} ${pluralPl(days, "dzień", "dni", "dni")}`;
}

export type WalkEstimate = { meters: number; minutes: number };

export function estimateWalk(straightLineMeters: number): WalkEstimate {
  const meters = Math.round(straightLineMeters * WALK_DETOUR_FACTOR);
  const minutes = Math.max(1, Math.round(meters / WALK_SPEED_M_PER_MIN));
  return { meters, minutes };
}

/** "ok. 850 m pieszo" / "ok. 1,2 km pieszo". Never presented as exact. */
export function formatWalkDistance(straightLineMeters: number): string {
  const { meters } = estimateWalk(straightLineMeters);
  if (meters < 1000) {
    return `ok. ${Math.round(meters / 10) * 10} m pieszo`;
  }
  const km = (meters / 1000).toFixed(1).replace(".", ",");
  return `ok. ${km} km pieszo`;
}

/** "ok. 11 min pieszo". */
export function formatWalkTime(straightLineMeters: number): string {
  const { minutes } = estimateWalk(straightLineMeters);
  return `ok. ${minutes} min pieszo`;
}

/** "1,9 m" — vehicle and clearance heights are stored in centimetres. */
export function formatHeight(cm: number): string {
  return `${(cm / 100).toFixed(2).replace(".", ",").replace(/,?0+$/, "")} m`;
}

/**
 * Polish has three plural forms, and "3 miejsc" is as wrong as "3 spaces" would
 * be "3 space". The teens are the trap: 2/3/4 take the second form, but 12/13/14
 * do not.
 *
 *   1                                  → miejsce
 *   2, 3, 4, 22, 23, 24, 32…           → miejsca
 *   0, 5…21, 25…31, and every teen     → miejsc
 */
export function pluralPl(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.trunc(n));
  if (abs === 1) return one;

  const lastTwo = abs % 100;
  if (lastTwo >= 12 && lastTwo <= 14) return many;

  const last = abs % 10;
  return last >= 2 && last <= 4 ? few : many;
}

/** "1 miejsce" / "3 miejsca" / "5 miejsc". */
export function formatSpots(n: number): string {
  return `${n} ${pluralPl(n, "miejsce", "miejsca", "miejsc")}`;
}

/** "1 kod" / "3 kody" / "5 kodów" — the scanner's offline pack. */
export function formatCodes(n: number): string {
  return `${n} ${pluralPl(n, "kod", "kody", "kodów")}`;
}

/** "1 parking" / "3 parkingi" / "5 parkingów". */
export function formatParkings(n: number): string {
  return `${n} ${pluralPl(n, "parking", "parkingi", "parkingów")}`;
}

/** "1 rezerwacja" / "3 rezerwacje" / "5 rezerwacji". */
export function formatBookings(n: number): string {
  return `${n} ${pluralPl(n, "rezerwacja", "rezerwacje", "rezerwacji")}`;
}
