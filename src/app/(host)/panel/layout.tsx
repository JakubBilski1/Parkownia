import type { Metadata } from "next";
import { HostShell } from "@/components/nav/app-shell";
import { getNavUser } from "@/components/nav/current-user";

export const metadata: Metadata = {
  title: "Panel hosta",
};

export default async function HostLayout({ children }: { children: React.ReactNode }) {
  const user = await getNavUser();

  return <HostShell user={user}>{children}</HostShell>;
}
