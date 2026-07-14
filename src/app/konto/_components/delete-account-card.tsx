"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ROUTES } from "@/components/nav/routes";
import { Button, Checkbox, Dialog } from "@/components/ui";
import { NETWORK_ERROR, readApiError, type ApiError } from "./api-error";

/**
 * Deletion is anonymisation (docs/DATA_MODEL.md §10): the person disappears, the
 * money does not. That is not a detail to bury in a tooltip — it is the whole
 * reason the confirmation exists, so it is spelled out before the click
 * (DESIGN_PRINCIPLES §6.3), not after it.
 */
export function DeleteAccountCard({ isHost }: { isHost: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const close = () => {
    if (loading) return;
    setOpen(false);
    setConfirmed(false);
    setError(null);
  };

  const remove = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/me", {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      // The server has cleared the auth cookies; a full navigation is the only
      // way to be sure no stale rendered page survives this.
      window.location.assign("/");
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-start gap-3">
        <p className="text-body text-muted">
          Usuwamy Twoje dane osobowe: imię, nazwisko, e-mail, telefon i hasło. Rezerwacje i
          rozliczenia zostają w systemie bez Twoich danych — wymaga tego prawo podatkowe.
          Tej operacji nie da się cofnąć.
        </p>

        <Button variant="danger" onClick={() => setOpen(true)}>
          Usuń konto
        </Button>
      </div>

      <Dialog
        open={open}
        onClose={close}
        title="Usunąć konto na stałe?"
        description="Przeczytaj, co dokładnie się stanie. Tej operacji nie cofniemy — ani my, ani Ty."
        actions={
          <>
            <Button variant="quiet" onClick={close} disabled={loading}>
              Zachowaj konto
            </Button>
            <Button
              variant="danger"
              onClick={() => void remove()}
              loading={loading}
              disabled={!confirmed}
            >
              Usuń konto
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-ui font-semibold text-ink">Co znika</h3>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-body text-muted">
              <li>Imię, nazwisko, e-mail, numer telefonu i hasło.</li>
              <li>Dostęp do konta — nie zalogujesz się już tym adresem.</li>
              {isHost ? (
                <li>Twoje parkingi znikają z mapy i przestają przyjmować rezerwacje.</li>
              ) : null}
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-ui font-semibold text-ink">Co zostaje</h3>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-body text-muted">
              <li>
                Rezerwacje i płatności — bez Twoich danych osobowych. Musimy je trzymać na
                potrzeby rozliczeń podatkowych.
              </li>
              <li>Zapis o udzielonych zgodach — to dowód, że ich udzieliłeś, i kiedy.</li>
            </ul>
          </div>

          <Checkbox
            label="Rozumiem, że tej operacji nie da się cofnąć."
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />

          {error ? (
            <div
              role="alert"
              className="flex flex-col gap-2 rounded-card border border-danger bg-danger-soft p-3"
            >
              <p className="flex items-start gap-1.5 text-body text-ink">
                <AlertCircle
                  size={18}
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-danger"
                />
                <span>
                  <span className="font-semibold">Nie usunęliśmy konta.</span> {error.message}
                </span>
              </p>

              {error.code === "ACTIVE_BOOKING" ? (
                <p className="text-ui text-muted">
                  Nic nie pobraliśmy i nic nie zmieniliśmy — konto i rezerwacja działają
                  dalej. Anuluj rezerwację (zwrot według regulaminu) albo wykorzystaj ją i
                  wróć tutaj po zakończeniu.{" "}
                  <Link
                    href={ROUTES.bookings}
                    className="font-semibold text-ink underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    Moje rezerwacje
                  </Link>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
