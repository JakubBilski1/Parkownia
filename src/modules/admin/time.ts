import { fromZonedTime } from "date-fns-tz";
import { APP_TIME_ZONE } from "@/lib/format";

/**
 * `<input type="datetime-local">` and `<input type="date">` hand back a wall
 * clock with no zone. The operator means Warsaw time; `new Date(value)` would
 * mean the server's zone, which in Docker is UTC — two hours of silent drift on
 * every kickoff time. Everything below the presentation layer stays UTC.
 */
export function warsawToUtc(local: string | undefined): Date | undefined {
  if (!local) return undefined;

  const [datePart, timePart = "00:00"] = local.split("T");
  if (!datePart) return undefined;

  const time = timePart.length === 5 ? `${timePart}:00` : timePart;
  const date = fromZonedTime(`${datePart} ${time}`, APP_TIME_ZONE);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** UTC instant -> the string a `datetime-local` input expects, in Warsaw time. */
export function utcToWarsawInput(date: Date): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return parts.replace(" ", "T");
}
