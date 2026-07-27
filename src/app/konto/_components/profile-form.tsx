"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input, useToast } from "@/components/ui";
import { NETWORK_ERROR, readApiError } from "./api-error";

/** What GET/PATCH /api/me hands back, trimmed to what this form touches. */
export type ProfileView = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
};

type Draft = { firstName: string; lastName: string; phone: string };

/**
 * Stored E.164 reads like a database column; "+48 601 234 567" reads like a
 * phone number. The schema strips the spaces again on the way back, so the
 * grouping costs nothing (DESIGN_PRINCIPLES §6.2).
 */
const prettyPhone = (phone: string | null): string => {
  if (!phone) return "";
  const match = /^\+48(\d{3})(\d{3})(\d{3})$/.exec(phone);
  return match ? `+48 ${match[1]} ${match[2]} ${match[3]}` : phone;
};

const toDraft = (profile: ProfileView): Draft => ({
  firstName: profile.firstName ?? "",
  lastName: profile.lastName ?? "",
  phone: prettyPhone(profile.phone),
});

/** Empty stays empty — an untouched field must not turn into a stored "". */
const orNull = (value: string): string | null => (value.trim() === "" ? null : value.trim());

/**
 * The same rule the server applies (modules/bookings/schemas.ts), and the same
 * sentence — a client that scolds in different words than the API is a client
 * that will one day contradict it.
 */
const PHONE_MESSAGE = "Podaj polski numer telefonu — 9 cyfr.";

function phoneLooksWrong(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  return !/^(\+48)?\d{9}$/.test(trimmed.replace(/[\s()-]/g, ""));
}

/**
 * RODO art. 16 in the interface: the page already exported and deleted, and now
 * it also corrects. The number matters beyond tidiness — checkout never
 * overwrites a phone already on file, so before this form a typo made at the
 * first purchase could not be fixed from anywhere in the product.
 */
export function ProfileForm({ initial }: { initial: ProfileView }) {
  const { toast } = useToast();
  const router = useRouter();

  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const base = toDraft(saved);

  /**
   * Only what actually changed goes to the server. That is not an optimisation:
   * accounts made before this form could hold a foreign number (the old
   * registration schema took any E.164), and re-sending an untouched one would
   * have the stricter Polish rule reject a save the user made to their name.
   */
  const changes = {
    ...(draft.firstName.trim() !== base.firstName.trim()
      ? { firstName: orNull(draft.firstName) }
      : {}),
    ...(draft.lastName.trim() !== base.lastName.trim()
      ? { lastName: orNull(draft.lastName) }
      : {}),
    ...(draft.phone.trim() !== base.phone.trim() ? { phone: orNull(draft.phone) } : {}),
  };

  const dirty = Object.keys(changes).length > 0;
  const phoneWrong = "phone" in changes && phoneLooksWrong(draft.phone);

  // Shown once they have left the field, not while they are still typing the
  // second digit (DESIGN_PRINCIPLES §6.4 — prevent, don't scold).
  const phoneError = phoneTouched && phoneWrong ? PHONE_MESSAGE : undefined;

  const set = (field: keyof Draft) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dirty || saving || phoneWrong) return;

    setSaving(true);

    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(changes),
      });

      if (!response.ok) {
        const error = await readApiError(response);
        toast({ tone: "error", message: "Nie zapisaliśmy zmian.", detail: error.message });
        return;
      }

      // The server answers with the profile as it now stands, so the form shows
      // the normalised number (+48…) rather than the string that was typed.
      const profile: ProfileView = await response.json();
      setSaved(profile);
      setDraft(toDraft(profile));
      setPhoneTouched(false);

      toast({ tone: "ok", message: "Zapisaliśmy zmiany." });

      // The page around this form is server-rendered — without this it would
      // keep showing the old name until the next full load.
      router.refresh();
    } catch {
      toast({
        tone: "error",
        message: "Nie zapisaliśmy zmian.",
        detail: NETWORK_ERROR.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Imię">
          {(control) => (
            <Input
              {...control}
              value={draft.firstName}
              onChange={set("firstName")}
              autoComplete="given-name"
              maxLength={80}
            />
          )}
        </Field>

        <Field label="Nazwisko">
          {(control) => (
            <Input
              {...control}
              value={draft.lastName}
              onChange={set("lastName")}
              autoComplete="family-name"
              maxLength={80}
            />
          )}
        </Field>
      </div>

      <Field
        label="Telefon"
        hint="Polski numer, 9 cyfr. Używamy go wyłącznie w sprawach Twoich rezerwacji — na przykład do SMS-a z kodem wjazdu."
        error={phoneError}
      >
        {(control) => (
          <Input
            {...control}
            value={draft.phone}
            onChange={set("phone")}
            onBlur={() => setPhoneTouched(true)}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="601 234 567"
          />
        )}
      </Field>

      <div className="flex flex-col gap-1 border-t border-line pt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          <span className="text-ui text-muted">E-mail</span>
          <span className="num text-body text-ink">{saved.email}</span>
        </div>
        <p className="text-ui text-muted">
          E-mail jest Twoim loginem i adresem, na który wysyłamy kody wjazdu — dlatego zmiana
          wymaga potwierdzenia z nowej skrzynki. Napisz na{" "}
          <a
            href="mailto:kontakt@parkownia.com"
            className="font-semibold text-ink underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            kontakt@parkownia.com
          </a>
          .
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={saving} disabled={!dirty || phoneWrong}>
          Zapisz zmiany
        </Button>
      </div>
    </form>
  );
}
