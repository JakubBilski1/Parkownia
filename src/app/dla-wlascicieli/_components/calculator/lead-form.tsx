"use client";

import { useState } from "react";
import { Button, Checkbox, Field, Input, inputBase } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { ContactPreference, ObjectType, OwnerKind } from "./types";

const OBJECT_TYPES: { value: ObjectType; label: string }[] = [
  { value: "LOT", label: "Plac / parking otwarty" },
  { value: "DRIVEWAY", label: "Podjazd / miejsce przy domu" },
  { value: "COMPANY_LOT", label: "Parking firmowy" },
  { value: "GARAGE", label: "Garaż / parking podziemny" },
  { value: "OTHER", label: "Inne" },
];

type FieldErrors = { contactName?: string; phone?: string; email?: string; consent?: string };

export function LeadForm({
  address,
  point,
  spots,
  ownerKind,
}: {
  address: string;
  point: { lat: number; lng: number } | null;
  spots: number;
  ownerKind: OwnerKind;
}) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [contactPreference, setContactPreference] = useState<ContactPreference>("PHONE");
  const [privacy, setPrivacy] = useState(false);
  const [marketingEmail, setMarketingEmail] = useState(false);
  const [marketingPhone, setMarketingPhone] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const contactName = String(form.get("contactName") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();

    const next: FieldErrors = {};
    if (contactName.length < 2) next.contactName = "Podaj imię.";
    if (contactPreference === "PHONE" && !phone) next.phone = "Wybrałeś telefon — podaj numer.";
    if (contactPreference === "EMAIL" && !email) next.email = "Wybrałeś e-mail — podaj adres.";
    if (!phone && !email) next.phone = "Zostaw telefon albo e-mail, żebyśmy mogli się odezwać.";
    if (!privacy) next.consent = "Bez tej zgody nie możemy przetwarzać Twoich danych.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setPending(true);
    setFormError(null);
    try {
      const res = await fetch("/api/dla-wlascicieli/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectName: String(form.get("objectName") ?? "").trim() || undefined,
          address,
          lat: point?.lat,
          lng: point?.lng,
          objectType: String(form.get("objectType") ?? "") || undefined,
          spots,
          ownerKind,
          contactName,
          phone: phone || undefined,
          email: email || undefined,
          contactPreference,
          privacyConsent: true,
          marketingEmailConsent: marketingEmail,
          marketingPhoneConsent: marketingPhone,
          website: String(form.get("website") ?? ""),
          source: "dla-wlascicieli",
        }),
      });
      if (!res.ok) throw new Error("submit");
      setDone(true);
    } catch {
      setFormError("Nie udało się wysłać. Sprawdź dane i spróbuj ponownie.");
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-card border border-line bg-surface p-6">
        <p className="font-display text-h2 font-extrabold tracking-tight text-ink">
          Dzięki! Odezwiemy się.
        </p>
        <p className="mt-2 text-body text-muted">
          To nie było zobowiązanie — po prostu porozmawiamy o Twoim miejscu. Zwykle kontaktujemy się
          w ciągu kilku dni roboczych.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div>
        <h3 className="text-h3 font-semibold text-ink">Zostaw kontakt</h3>
        <p className="mt-1 text-body text-muted">
          To nie jest zobowiązanie, tylko rozmowa. Adres i liczbę miejsc bierzemy z kalkulatora powyżej.
        </p>
      </div>

      {formError ? (
        <p role="alert" className="rounded-card border border-danger bg-danger-soft px-3 py-2 text-ui text-danger">
          {formError}
        </p>
      ) : null}

      <Field label="Nazwa obiektu (opcjonalnie)">
        {(field) => (
          <Input {...field} name="objectName" placeholder="np. parking warsztatu przy Grunwaldzkiej" />
        )}
      </Field>

      <div>
        <label htmlFor="lead-object-type" className="mb-1 block text-ui font-semibold text-ink">
          Typ obiektu
        </label>
        <select id="lead-object-type" name="objectType" defaultValue="" className={cn(inputBase, "w-full")}>
          <option value="">Wybierz…</option>
          {OBJECT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <Field label="Imię" required error={errors.contactName}>
        {(field) => <Input {...field} name="contactName" autoComplete="given-name" placeholder="Jan" />}
      </Field>

      <fieldset>
        <legend className="mb-1 text-ui font-semibold text-ink">Jak się skontaktować?</legend>
        <div className="flex gap-4">
          {(["PHONE", "EMAIL"] as ContactPreference[]).map((pref) => (
            <label key={pref} className="inline-flex min-h-touch items-center gap-2 text-body text-ink">
              <input
                type="radio"
                name="contactPreference"
                value={pref}
                checked={contactPreference === pref}
                onChange={() => setContactPreference(pref)}
                style={{ accentColor: "var(--accent)" }}
              />
              {pref === "PHONE" ? "Telefon" : "E-mail"}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Telefon" error={errors.phone}>
        {(field) => (
          <Input {...field} name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="600 100 200" />
        )}
      </Field>
      <Field label="E-mail" error={errors.email}>
        {(field) => (
          <Input {...field} name="email" type="email" autoComplete="email" placeholder="jan@przyklad.pl" />
        )}
      </Field>

      {/* Honeypot: off-screen (not display:none — some bots skip hidden fields),
          aria-hidden and out of the tab order. A filled value → the server drops it. */}
      <div aria-hidden="true" className="pointer-events-none absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Nie wypełniaj tego pola
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3">
        <Checkbox
          checked={privacy}
          onChange={(event) => setPrivacy(event.target.checked)}
          label={
            <span>
              Zgadzam się na przetwarzanie moich danych, żeby Parkownia mogła się ze mną skontaktować,
              zgodnie z{" "}
              <a href="/prywatnosc" className="underline underline-offset-4">
                polityką prywatności
              </a>
              .
            </span>
          }
        />
        <Checkbox
          checked={marketingEmail}
          onChange={(event) => setMarketingEmail(event.target.checked)}
          label="Chcę dostawać e-maile o zarabianiu na parkingu (opcjonalnie)."
        />
        <Checkbox
          checked={marketingPhone}
          onChange={(event) => setMarketingPhone(event.target.checked)}
          label="Zgadzam się na kontakt telefoniczny w sprawie oferty (opcjonalnie)."
        />
        {errors.consent ? (
          <p role="alert" className="text-ui text-danger">
            {errors.consent}
          </p>
        ) : null}
      </div>

      <p className="text-ui text-muted">
        Administrator danych: Jakub Bilski, ul. Krótka 10a, Mosina. Dane przetwarzamy, by się z Tobą
        skontaktować; masz prawo dostępu, sprostowania i usunięcia — napisz na kontakt@parkownia.com.
      </p>

      <Button type="submit" variant="accent" size="lg" block loading={pending}>
        Porozmawiajmy o moim miejscu
      </Button>
    </form>
  );
}
