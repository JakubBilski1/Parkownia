import type { Metadata } from "next";
import { getAdminSession } from "@/modules/admin/session";
import { AccessDenied } from "../_components/access-denied";
import { ResearchView, type ResearchParams } from "./_components/research-view";

export const metadata: Metadata = {
  title: "Akwizycja podaży",
  robots: { index: false, follow: false },
};

/**
 * The door. Everything the page actually renders lives in ResearchView, and it
 * lives there for a reason: `getAdminSession()` needs a database, there is no
 * local PostGIS (CLAUDE.md), and this project has already shipped a dead
 * stylesheet through a green gate. Mounting ResearchView on a throwaway route
 * with no auth is the only way to LOOK at this page before pushing it. Next also
 * forbids extra named exports from a page module, so the split is mandatory.
 */
export default async function AcquisitionPage({
  searchParams,
}: {
  searchParams: Promise<ResearchParams>;
}) {
  const session = await getAdminSession();
  if (!session) return <AccessDenied />;

  return <ResearchView params={await searchParams} />;
}
