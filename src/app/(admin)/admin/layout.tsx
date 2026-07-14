import type { Metadata } from "next";
import { AdminShell } from "@/components/nav/app-shell";
import { getNavUser } from "@/components/nav/current-user";

export const metadata: Metadata = {
  title: "Panel administratora",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getNavUser();

  return <AdminShell user={user}>{children}</AdminShell>;
}
