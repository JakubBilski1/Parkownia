import type { Metadata } from "next";
import { MapScreen } from "@/components/map/map-screen";
import { AppShell } from "@/components/nav/app-shell";
import { getNavUser } from "@/components/nav/current-user";
import { canAcceptPayments } from "@/modules/payments/factory";

export const metadata: Metadata = {
  title: "Mapa parkingów",
  description:
    "Wolne miejsca przy Enea Stadionie i MTP. Wybierz pin, zapłać z góry, wjedź na kod.",
  alternates: { canonical: "/mapa" },
};

/**
 * The driver's home screen. It moved off `/` when the owners' landing took the
 * front door: with no supply yet, the page that acquires parkings has to be the
 * first thing a stranger sees. Once there is something on the map, revisit this.
 *
 * Nothing else changed — the active booking still rides above the map
 * (DESIGN_PRINCIPLES §6.5) and the primary navigation sits under the thumb.
 */
export default async function MapPage() {
  const user = await getNavUser();

  return (
    <AppShell user={user}>
      <MapScreen salesOpen={canAcceptPayments()} />
    </AppShell>
  );
}
