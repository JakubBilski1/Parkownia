"use client";

import { Pause, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, useToast } from "@/components/ui";

export type ParkingActionsProps = {
  parkingId: string;
  status: string;
};

export function ParkingActions({ parkingId, status }: ParkingActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  if (status !== "ACTIVE" && status !== "PAUSED") return null;

  const paused = status === "PAUSED";

  async function run() {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/parkings/${parkingId}/${paused ? "resume" : "pause"}`,
        { method: "POST" },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        toast({
          tone: "error",
          message: payload?.error?.message ?? "Nie udało się zmienić statusu parkingu.",
          detail: "Nic nie zostało zmienione. Spróbuj ponownie.",
        });
        return;
      }

      toast({
        tone: "ok",
        message: paused ? "Parking wrócił do sprzedaży." : "Parking wstrzymany.",
        detail: paused
          ? "Kierowcy znów go widzą na mapie."
          : "Nie zniknie z mapy dla osób, które już mają rezerwację.",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" onClick={run} loading={busy}>
      {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
      {paused ? "Wznów sprzedaż" : "Wstrzymaj"}
    </Button>
  );
}
