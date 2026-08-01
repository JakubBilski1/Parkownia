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
 * One colour per category — what kind of event this is, not who is playing.
 *
 * This replaced a map of club colours read out of the fixture title. That scheme
 * only ever painted football: a trade fair, a concert and a marathon all came out
 * identical, which is backwards, because a driver scanning this grid is choosing
 * between KINDS of evening. It also made the page look like a league table for a
 * competition Parkownia has nothing to do with, and it broke the moment an
 * opponent was renamed or a non-league fixture appeared.
 *
 * Rules the values follow:
 *
 *  - No reds. The accent is stamp red in both themes and means "this is where you
 *    pay" (DESIGN_PRINCIPLES §4). A category that borrowed it would make the
 *    single accent on the page stop meaning anything.
 *  - Mid chroma and mid lightness, because the same hex is washed over a near
 *    white card in Bilet and a near black one in Zmierzch. Anything very light or
 *    very dark disappears into one of them.
 *  - Never the only carrier: every card also states the category in words and in
 *    an icon (see CategoryTag), which is what keeps this readable for the ~8% of
 *    men who cannot separate these greens and browns — and a football crowd is
 *    exactly that audience.
 */
export const EVENT_CATEGORY_COLOUR: Record<EventCategory, string> = {
  FOOTBALL: "#1D6FB8", // the pitch under floodlights, and the home side's blue
  TRADE_FAIR: "#C98A1E", // MTP ochre — trade, not sport
  CONCERT: "#7B4FC9",
  SPORTS: "#1F9E7A", // distinct from football: this is the marathon, not the league
  FESTIVAL: "#C94FA0",
  OTHER: "#6B7280", // deliberately grey: "we do not know what this is" is a fact
};
