import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PayoutsScreen } from "./payouts-screen";

export const metadata: Metadata = {
  title: "Wypłaty",
};

export const dynamic = "force-dynamic";

export default function PayoutsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4" aria-busy="true">
          <span className="sr-only">Wczytujemy stan wypłat.</span>
          <Skeleton className="h-10 w-40 rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
        </div>
      }
    >
      <PayoutsScreen />
    </Suspense>
  );
}
