import { CalendarDays, Medal, Music, PartyPopper, Store, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { EventCategory } from "@/db/types";

/** The user says "mecz", never "FOOTBALL" (docs/DESIGN_PRINCIPLES.md §6.2). */
export const EVENT_CATEGORY_LABEL: Record<EventCategory, string> = {
  FOOTBALL: "Mecz",
  CONCERT: "Koncert",
  TRADE_FAIR: "Targi",
  SPORTS: "Sport",
  FESTIVAL: "Festiwal",
  OTHER: "Wydarzenie",
};

export const EVENT_CATEGORY_ICON: Record<EventCategory, LucideIcon> = {
  FOOTBALL: Trophy,
  CONCERT: Music,
  TRADE_FAIR: Store,
  SPORTS: Medal,
  FESTIVAL: PartyPopper,
  OTHER: CalendarDays,
};

/**
 * Club colours — the identity colour of each club in src/db/seed.ts MATCHES.
 *
 * Colours, not crests. A club crest is a registered trademark, and on a card that
 * sells something it implies a partnership Parkownia does not have. The name of a
 * match is a fact we may state; the badge is not ours to borrow. Colours carry the
 * same information to a fan — you know a fixture by the away side's colours from
 * across the concourse — and are nobody's mark.
 *
 * This is deliberately NOT the brand accent (DESIGN_PRINCIPLES §4). Like the
 * scanner's greens and reds, these encode what a thing *is*; the accent stays the
 * one colour that means "this is where you pay".
 *
 * One colour per club, and never white: several clubs are white-and-X (Cracovia is
 * biało-czerwona, "Pasy"), but white cannot tint a white card. The value below is
 * each club's operative, usable identity colour.
 *
 * Researched from each club's own site and the pl.wikipedia "Barwy" infobox, then
 * independently re-checked. Two came back corrected: Piast's and Pogoń's hexes are
 * sampled from the clubs' own crest artwork, not from third-party brand-colour
 * aggregators, which had them wrong.
 */
export const CLUB_COLOUR: Record<string, string> = {
  "Lech Poznań": "#0E4F95", // niebiesko-białe — blue leads ("Niebiesko-Biali")
  Cracovia: "#E30613", // biało-czerwone; red is the usable half of the stripes
  "Piast Gliwice": "#004B9A", // sampled from the club's own crest artwork
  "Jagiellonia Białystok": "#FFF200", // żółto-czerwoni
  "Raków Częstochowa": "#F0000F",
  "Radomiak Radom": "#009640", // zielono-biali
  "Korona Kielce": "#FEC601",
  "Wisła Kraków": "#C8102E",
  "Zagłębie Lubin": "#EB6F08", // miedziowe — copper, for the local mines
  "Pogoń Szczecin": "#00245D", // sampled from the club's own crest artwork
};

export type MatchColours = { home: string; away: string };

/**
 * The two clubs in a fixture title, in the order they are written.
 *
 * The title is composed in the seed as "Lech Poznań – {opponent}" and the pairing
 * is not stored as columns, so it is read back out of the title — the same way the
 * event slug is derived rather than persisted. Matching on known club names rather
 * than splitting on the dash keeps a renamed or oddly punctuated title from
 * producing a nonsense colour instead of simply no colour.
 *
 * Returns null unless both clubs are known, so an unmapped opponent degrades to
 * the plain card rather than to a half-painted one.
 */
export function matchColours(title: string): MatchColours | null {
  const found = Object.keys(CLUB_COLOUR)
    .map((club) => ({ club, at: title.indexOf(club) }))
    .filter((hit) => hit.at !== -1)
    .sort((a, b) => a.at - b.at);

  if (found.length < 2) return null;
  const home = CLUB_COLOUR[found[0]!.club];
  const away = CLUB_COLOUR[found[1]!.club];
  if (!home || !away) return null;
  return { home, away };
}
