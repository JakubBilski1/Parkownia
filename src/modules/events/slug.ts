import { formatInTimeZone } from "date-fns-tz";
import { APP_TIME_ZONE } from "@/lib/format";

const ID_PREFIX_LENGTH = 8;
const ID_PREFIX_PATTERN = /^[0-9a-f]{8}$/;

const PL_TRANSLITERATION: Record<string, string> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z",
};

export function slugifyPl(input: string): string {
  return input
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (char) => PL_TRANSLITERATION[char] ?? char)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The events table has no slug column (src/db/schema.ts is shared and frozen for
 * this module), so the slug is derived and carries an id prefix as its last
 * segment. That prefix — not the title — is what resolves the row.
 */
export function eventSlug(event: { id: string; title: string; startsAt: Date }): string {
  const day = formatInTimeZone(event.startsAt, APP_TIME_ZONE, "dd-MM");
  const idPrefix = event.id.replace(/-/g, "").slice(0, ID_PREFIX_LENGTH);
  return `${slugifyPl(event.title)}-${day}-${idPrefix}`;
}

export function eventIdPrefixFromSlug(slug: string): string | null {
  const last = slug.split("-").at(-1)?.toLowerCase() ?? "";
  return ID_PREFIX_PATTERN.test(last) ? last : null;
}
