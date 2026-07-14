"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { looksLikeBookingCode, normalizeBookingCode } from "@/modules/scan/hash";
import type { ManifestParking } from "@/modules/scan/types";
import { OptionButton } from "./option-button";

/**
 * The keyboard is the fallback that never fails: dead camera, cracked lens,
 * screen too dim to read a QR, phone from 2016. It is one tap away from the
 * camera at all times, not buried in a menu.
 */
export function ManualEntry({
  open,
  onClose,
  parkings,
  parkingId,
  onChooseParking,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  parkings: ManifestParking[];
  parkingId: string | null;
  onChooseParking: (id: string) => void;
  onSubmit: (code: string) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (open) {
      setCode("");
      setError(undefined);
    }
  }, [open]);

  const submit = async () => {
    const normalized = normalizeBookingCode(code);
    if (!looksLikeBookingCode(normalized)) {
      setError("Kod ma co najmniej 6 znaków — same litery, cyfry i myślniki. Przepisz go z ekranu kierowcy.");
      return;
    }
    await onSubmit(normalized);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Wpisz kod ręcznie"
      footer={
        <Button variant="accent" block size="lg" onClick={() => void submit()}>
          Sprawdź kod
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Kod rezerwacji"
          hint="Jest w mailu i SMS-ie kierowcy, nad kodem QR."
          error={error}
          required
        >
          {(field) => (
            <Input
              {...field}
              value={code}
              onChange={(event) => {
                setCode(event.target.value.toUpperCase());
                setError(undefined);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submit();
              }}
              autoFocus
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              enterKeyHint="go"
              placeholder="PK-7H2K-9QW3"
              className="num font-mono text-lead tracking-[0.06em]"
            />
          )}
        </Field>

        {parkings.length > 1 ? (
          <div className="flex flex-col gap-2">
            <p className="text-ui font-semibold text-ink">Brama</p>
            {parkings.map((parking) => (
              <OptionButton
                key={parking.id}
                selected={parking.id === parkingId}
                onClick={() => onChooseParking(parking.id)}
              >
                <span className="text-body font-semibold">{parking.title}</span>
              </OptionButton>
            ))}
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
