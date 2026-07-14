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
