"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/format";

type Preview = {
  refundGr: number;
  refundPct: number;
  priceGr: number;
};

/**
 * Cancellation is visible, not buried, and it states its consequences BEFORE the
 * click (DESIGN_PRINCIPLES §6.3). The preview call is the whole point: nobody
 * finds out they lost 35 zł after the fact.
 */
export function CancelBooking({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function openPreview() {
    setLoading(true);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/cancel?preview=true`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        toast({
          tone: "error",
          message: data?.error?.message ?? "Nie udało się sprawdzić warunków zwrotu.",
          detail: "Rezerwacja jest nadal ważna. Spróbuj ponownie za chwilę.",
        });
        return;
      }
      setPreview({ refundGr: data.refundGr, refundPct: data.refundPct, priceGr: data.priceGr });
    } finally {
      setLoading(false);
    }
  }

  async function confirmCancel() {
    setCancelling(true);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        toast({
          tone: "error",
          message: data?.error?.message ?? "Nie udało się anulować rezerwacji.",
          detail: "Rezerwacja jest nadal ważna, pieniądze nie wróciły. Spróbuj ponownie.",
        });
        return;
      }

      setPreview(null);
      toast({
        tone: "info",
        message: "Anulowano rezerwację.",
        detail: data.refundPending
          ? `Zwrot ${formatMoney(data.refundGr)} jest w toku — odezwiemy się mailem, gdy pieniądze wyjdą.`
          : data.refundGr > 0
            ? `Zwracamy ${formatMoney(data.refundGr)}. Pieniądze wrócą na Twoje konto w ciągu kilku dni.`
            : "Zgodnie z polityką zwrotów nie zwracamy pieniędzy przy anulowaniu tak blisko terminu.",
      });
      router.refresh();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <Button variant="danger" size="md" block loading={loading} onClick={openPreview}>
        Anuluj rezerwację
      </Button>

      <Dialog
        open={preview !== null}
        onClose={() => setPreview(null)}
        title="Anulować rezerwację?"
        description={
          preview
            ? preview.refundGr > 0
              ? `Zwrócimy ${formatMoney(preview.refundGr)} z ${formatMoney(preview.priceGr)} (${preview.refundPct}%). Miejsce wróci do sprzedaży od razu.`
              : `Na tym etapie nie zwracamy pieniędzy — zapłaciłeś ${formatMoney(preview.priceGr)} i te środki przepadają. Miejsce wróci do sprzedaży od razu.`
            : undefined
        }
        actions={
          <>
            <Button variant="quiet" onClick={() => setPreview(null)}>
              Zostawiam rezerwację
            </Button>
            <Button variant="danger" loading={cancelling} onClick={confirmCancel}>
              Anuluj i zwróć
            </Button>
          </>
        }
      />
    </>
  );
}
