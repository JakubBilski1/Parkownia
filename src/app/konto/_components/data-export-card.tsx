"use client";

import { Check, Download } from "lucide-react";
import { useState } from "react";
import { Button, useToast } from "@/components/ui";
import { NETWORK_ERROR, readApiError } from "./api-error";

/**
 * The export itself is never held on disk — the link regenerates it when opened
 * (src/app/api/me/data-export/route.ts). So the honest promise on screen is
 * "a link is on its way", not "your file is ready".
 */
export function DataExportCard({ email }: { email: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const request = async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/me/data-export", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await readApiError(response);
        toast({
          tone: "error",
          message: "Nie wysłaliśmy linku do pobrania danych.",
          detail: error.message,
        });
        return;
      }

      setSent(true);
      toast({ tone: "ok", message: "Link wysłany na Twój e-mail." });
    } catch {
      toast({
        tone: "error",
        message: "Nie wysłaliśmy linku do pobrania danych.",
        detail: NETWORK_ERROR.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-body text-muted">
        Dostaniesz plik JSON ze wszystkim, co o Tobie mamy: profil, zgody, rezerwacje,
        płatności i wysłane powiadomienia. Wyślemy link do pobrania na Twój adres e-mail
        ({email}). Link jest ważny 24 godziny.
      </p>

      <Button variant="quiet" onClick={() => void request()} loading={loading}>
        <Download size={18} aria-hidden="true" />
        Pobierz moje dane
      </Button>

      {sent ? (
        <p className="flex items-start gap-1.5 text-ui text-ink" role="status">
          <Check size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-scan-ok" />
          <span>
            Wysłaliśmy link na {email}. Jeśli go nie widzisz, sprawdź folder ze spamem.
          </span>
        </p>
      ) : null}
    </div>
  );
}
