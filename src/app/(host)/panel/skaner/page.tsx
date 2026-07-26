import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES } from "@/components/nav/routes";
import { LockKeyhole } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PwaRegister } from "@/components/pwa-register";
import { getScanContext } from "@/modules/scan/session";
import { ScannerScreen } from "./scanner-screen";

export const metadata: Metadata = {
  title: "Skaner",
  // The scanner is the installable part of the product; the rest of the app is a website.
  manifest: "/manifest.json",
};

export const dynamic = "force-dynamic";

export default async function ScannerPage() {
  // Context, not just the session: an employee cut loose from their client
  // would otherwise pass this gate and meet a 403 from every scan instead.
  const context = await getScanContext();

  if (!context) {
    return (
      <main className="mx-auto flex min-h-full w-full max-w-[32rem] items-center p-4">
        <EmptyState
          icon={LockKeyhole}
          title="Skaner jest dla hostów"
          description="Zaloguj się na konto, na którym masz parking. Skaner pokazuje kody tylko z Twoich parkingów."
          action={
            <Link
              href={ROUTES.login}
              className="inline-flex min-h-touch items-center rounded-button border border-line bg-surface px-4 font-semibold text-ink"
            >
              Zaloguj się
            </Link>
          }
        />
      </main>
    );
  }

  return (
    <>
      <PwaRegister />
      <ScannerScreen />
    </>
  );
}
