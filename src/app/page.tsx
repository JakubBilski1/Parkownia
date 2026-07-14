import { MapScreen } from "@/components/map/map-screen";
import { AppShell } from "@/components/nav/app-shell";
import { getNavUser } from "@/components/nav/current-user";

/**
 * The map is the home screen: no marketing page stands between a driver in the
 * rain and the pin they need. The active booking rides above it (DESIGN_PRINCIPLES
 * 6.5) and the primary navigation sits under the thumb.
 */
export default async function HomePage() {
  const user = await getNavUser();

  return (
    <AppShell user={user}>
      <MapScreen />
    </AppShell>
  );
}
