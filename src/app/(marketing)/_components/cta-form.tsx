"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Checkbox, Field, Input, NumberField } from "@/components/ui";
import { leadSource } from "./lead-source";

type Errors = Partial<Record<"address" | "spots" | "contactName" | "contact" | "consent", string>>;

/**
 * The short way in, for somebody who read to the bottom and never touched the
 * calculator. It writes the same lead as the wizard does — same endpoint, same
 * server-side validation, different `source` so the two can be told apart in
 * /admin/leady.
 *
 * Deliberately shorter than the wizard: no object type, no owner kind, no
 * marketing consents. Everything the sales conversation can establish by asking
 * is left to the sales conversation (DESIGN_PRINCIPLES §6.7). What stays is what
 * the schema needs to store a usable lead: where, how big, who, and how to
 * reach them.
 */
export function CtaForm() {
  const searchParams = useSearchParams();
  const [address, setAddress] = useState("");
  const [spots, setSpots] = useState(10);
  // Set once the visitor types here themselves. After that the calculator stops
  // reaching in — their own words beat anything we can infer.
  const edited = useRef(false);
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [website, setWebsite] = useState("");

  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  /**
   * Somebody who typed their address into the calculator, watched it work out
   * what they could earn, and scrolled down was then asked for the same address
   * again. At the bottom of a funnel that is a pure tax on the person most
   * likely to convert.
   *
   * The calculator already mirrors its state into the query string, so this
   * reads from there rather than reaching across components — which also means a
   * shared link like /?adres=…&miejsca=30 arrives with both filled in.
   */
  const paramAddress = searchParams.get("adres");
  const paramSpots = Number(searchParams.get("miejsca"));

  useEffect(() => {
    if (edited.current) return;
    if (paramAddress && paramAddress.trim().length >= 3) setAddress(paramAddress);
    if (Number.isFinite(paramSpots) && paramSpots >= 1 && paramSpots <= 100) {
      setSpots(Math.round(paramSpots));
    }
  }, [paramAddress, paramSpots]);

  function validate(): Errors {
    const found: Errors = {};
    if (address.trim().length < 3) found.address = "Podaj adres obiektu.";
    if (spots < 1 || spots > 100) found.spots = "Od 1 do 100 miejsc.";
    if (contactName.trim().length < 2) found.contactName = "Podaj imię.";
    if (!phone.trim() && !email.trim()) {
      found.contact = "Zostaw telefon albo e-mail — inaczej nie mamy jak się odezwać.";
    }
    if (!privacy) found.consent = "Bez tej zgody nie możemy przetwarzać Twoich danych.";
    return found;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setPending(true);
    setFormError(null);
    try {
      const res = await fetch("/api/dla-wlascicieli/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: address.trim(),
          spots,
          contactName: contactName.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          // Whichever channel they actually left. Phone wins when both are
          // there — it is the faster call to make.
          contactPreference: phone.trim() ? "PHONE" : "EMAIL",
          privacyConsent: true,
          website,
          source: leadSource("cta-koniec"),
        }),
      });
      if (!res.ok) throw new Error("submit");
      setDone(true);
    } catch {
      setFormError("Nie udało się wysłać. Sprawdź dane i spróbuj ponownie.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-card border border-line bg-surface p-6">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-pill bg-accent text-accent-ink">
          <Check size={20} aria-hidden="true" />
        </span>
        <h3 className="font-display text-h3 font-bold text-ink">Mamy Twoje zgłoszenie</h3>
        <p className="text-body text-muted">
          Odezwiemy się w ciągu dwóch dni roboczych — na numer albo adres, który zostawiłeś.
          Nic nie musisz teraz robić.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      // Field marks its controls required, which hands validation to the browser:
      // a native bubble, in the browser's language, saying "Wypełnij to pole" —
      // and our own messages never get to run. The rules below say what is wrong
      // and what to do about it (DESIGN_PRINCIPLES §6.10), so they own it.
      noValidate
      className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6 shadow-card"
    >
      <Field label="Adres obiektu" required error={errors.address}>
        {(control) => (
          <Input
            {...control}
            value={address}
            onChange={(event) => {
              edited.current = true;
              setAddress(event.target.value);
            }}
            placeholder="np. Bułgarska 17, Poznań"
            autoComplete="street-address"
          />
        )}
      </Field>

      <Field label="Liczba miejsc" required error={errors.spots}>
        {(control) => (
          <NumberField
            id={control.id}
            value={spots}
            onValueChange={(next) => {
              edited.current = true;
              setSpots(next);
            }}
            min={1}
            max={100}
            steppers
            suffix="miejsc"
          />
        )}
      </Field>

      <Field label="Imię" required error={errors.contactName}>
        {(control) => (
          <Input
            {...control}
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
            autoComplete="given-name"
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Telefon" error={errors.contact}>
          {(control) => (
            <Input
              {...control}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="601 234 567"
            />
          )}
        </Field>

        <Field label="E-mail">
          {(control) => (
            <Input
              {...control}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              placeholder="jan@example.com"
            />
          )}
        </Field>
      </div>

      <Checkbox
        label={
          <>
            Zgadzam się na przetwarzanie moich danych w celu kontaktu.{" "}
            <Link href="/prywatnosc" className="underline underline-offset-4">
              Polityka prywatności
            </Link>
            .
          </>
        }
        checked={privacy}
        onChange={(event) => setPrivacy(event.target.checked)}
      />
      {errors.consent ? (
        <p role="alert" className="text-ui text-danger">
          {errors.consent}
        </p>
      ) : null}

      {/* Honeypot. A person never sees it, a bot fills it, the server drops it. */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(event) => setWebsite(event.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      {formError ? (
        <p role="alert" className="text-ui text-danger">
          {formError}
        </p>
      ) : null}

      {/* The primary action of the page's closing section — the one place on it
          that earns the accent (DESIGN_SYSTEM: "the one sacred use"). */}
      <Button
        type="submit"
        variant="accent"
        loading={pending}
        className="w-full sm:w-auto sm:self-start"
      >
        Wyślij zgłoszenie
      </Button>
    </form>
  );
}
