"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, Field, Input, RadioGroup } from "@/components/ui";
import { ApiClientError, getJson, postJson } from "@/modules/auth/api-client";
import { isValidNip, normalizeNip } from "@/modules/auth/nip";
import type { NipLookupResult } from "@/modules/auth/service";
import { FormError } from "../form-error";

type HostType = "INDIVIDUAL" | "BUSINESS";

type LookupState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "found"; result: NipLookupResult }
  | { kind: "missing" }
  | { kind: "registry-down" };

const REGISTRY_DOWN_HINT =
  "Rejestr Ministerstwa Finansów nie odpowiada. Wpisz dane firmy ręcznie — zweryfikujemy je przed pierwszą wypłatą.";

export function HostForm({
  defaultNip,
  defaultCompanyName,
  defaultAddress,
}: {
  defaultNip: string;
  defaultCompanyName: string;
  defaultAddress: string;
}) {
  const router = useRouter();

  const [hostType, setHostType] = useState<HostType>("INDIVIDUAL");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nip, setNip] = useState(defaultNip);
  const [nipError, setNipError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<LookupState>({ kind: "idle" });
  const [companyName, setCompanyName] = useState(defaultCompanyName);
  const [address, setAddress] = useState(defaultAddress);

  // The lookup is rate-limited to 3/min: fire it once per NIP, not once per keystroke.
  const lastLookedUp = useRef<string | null>(null);

  async function runLookup(digits: string) {
    if (lastLookedUp.current === digits) return;
    lastLookedUp.current = digits;

    setLookup({ kind: "loading" });

    try {
      const result = await getJson<NipLookupResult>(`/api/business/nip-lookup?nip=${digits}`);

      if (!result.found) {
        setLookup({ kind: "missing" });
        return;
      }

      setLookup({ kind: "found", result });
      setCompanyName(result.companyName);
      setAddress(result.address ?? "");
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.code === "WHITELIST_UNAVAILABLE") {
        setLookup({ kind: "registry-down" });
        return;
      }

      setLookup({ kind: "idle" });
      lastLookedUp.current = null;
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : "Nie udało się sprawdzić NIP-u. Wpisz dane firmy ręcznie.",
      );
    }
  }

  /** Validate at the 10th digit, not after submit (DESIGN_PRINCIPLES §6.4). */
  function onNipChange(value: string) {
    setNip(value);
    setError(null);

    const digits = normalizeNip(value);

    if (digits.length < 10) {
      setNipError(null);
      setLookup({ kind: "idle" });
      return;
    }

    if (!isValidNip(digits)) {
      setNipError("Ten NIP jest niepoprawny — sprawdź cyfry.");
      setLookup({ kind: "idle" });
      return;
    }

    setNipError(null);
    void runLookup(digits);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      if (hostType === "INDIVIDUAL") {
        await postJson("/api/auth/upgrade-to-host", { hostType: "INDIVIDUAL" });
      } else {
        const digits = normalizeNip(nip);
        if (!isValidNip(digits)) {
          setNipError("Ten NIP jest niepoprawny — sprawdź cyfry.");
          setPending(false);
          return;
        }

        await postJson("/api/business/profile", {
          nip: digits,
          companyName: companyName.trim(),
          address: address.trim() || undefined,
        });
      }

      router.replace("/panel");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : "Nie udało się zapisać danych. Spróbuj ponownie.",
      );
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormError message={error} />

      <RadioGroup<HostType>
        name="hostType"
        legend="Kto wynajmuje miejsce?"
        value={hostType}
        onValueChange={setHostType}
        options={[
          {
            value: "INDIVIDUAL",
            label: "Prywatnie",
            hint: "Podjazd, garaż, miejsce w bloku. Prowizja 50%.",
          },
          {
            value: "BUSINESS",
            label: "Firma",
            hint: "Parking firmowy, plac, operator. Prowizja 30%.",
          },
        ]}
      />

      {hostType === "BUSINESS" ? (
        <div className="flex flex-col gap-4">
          <Field
            label="NIP"
            required
            hint="Dane pobierzemy z Białej listy podatników VAT."
            error={nipError ?? undefined}
          >
            {(field) => (
              <Input
                {...field}
                name="nip"
                inputMode="numeric"
                autoComplete="off"
                maxLength={13}
                placeholder="1234563218"
                value={nip}
                onChange={(event) => onNipChange(event.target.value)}
              />
            )}
          </Field>

          {lookup.kind === "loading" ? (
            <p className="text-ui text-muted" aria-live="polite">
              Sprawdzamy NIP w rejestrze…
            </p>
          ) : null}

          {lookup.kind === "missing" ? (
            <p className="text-ui text-muted" aria-live="polite">
              Nie znaleźliśmy tego NIP-u w rejestrze. Sprawdź cyfry albo wpisz dane ręcznie.
            </p>
          ) : null}

          {lookup.kind === "registry-down" ? (
            <p
              className="rounded-button border border-line bg-surface-2 p-3 text-ui text-ink"
              aria-live="polite"
            >
              {REGISTRY_DOWN_HINT}
            </p>
          ) : null}

          {lookup.kind === "found" && lookup.result.vatStatus ? (
            <p className="text-ui text-muted" aria-live="polite">
              Status VAT w rejestrze: <span className="text-ink">{lookup.result.vatStatus}</span>
            </p>
          ) : null}

          <Field label="Nazwa firmy" required hint="Możesz poprawić, jeśli rejestr się myli.">
            {(field) => (
              <Input
                {...field}
                name="companyName"
                autoComplete="organization"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
              />
            )}
          </Field>

          <Field label="Adres">
            {(field) => (
              <Input
                {...field}
                name="address"
                autoComplete="street-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
              />
            )}
          </Field>
        </div>
      ) : null}

      <Button type="submit" variant="accent" size="lg" block loading={pending}>
        {hostType === "BUSINESS" ? "Zapisz dane firmy" : "Zacznij wynajmować"}
      </Button>
    </form>
  );
}
