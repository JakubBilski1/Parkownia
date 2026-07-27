"use client";

import { Check } from "lucide-react";
import { useId, useState } from "react";
import { Button, Checkbox, Dialog, Field, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoney, formatSpots } from "@/lib/format";
import type { ContactPreference, ObjectType, OwnerKind } from "./types";

const OBJECT_TYPES: { value: ObjectType; label: string; hint: string }[] = [
  { value: "LOT", label: "Plac / parking otwarty", hint: "Utwardzony teren, wjazd z ulicy" },
  { value: "DRIVEWAY", label: "Podjazd / miejsce przy domu", hint: "Jedno albo kilka aut" },
  { value: "COMPANY_LOT", label: "Parking firmowy", hint: "Pusty po godzinach i w weekendy" },
  { value: "GARAGE", label: "Garaż / parking podziemny", hint: "Zadaszony, z ograniczeniem wysokości" },
  { value: "OTHER", label: "Inne", hint: "Opowiesz nam przez telefon" },
];

const STEPS = ["Obiekt", "Kontakt", "Zgody"] as const;

type FieldErrors = {
  objectType?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  consent?: string;
};

/**
 * The lead form as a three-step dialog instead of a fourteen-control wall.
 *
 * One question at a time is not decoration: Hick's law (§6.7) says a long form
 * shown at once is a longer decision, and this form asks a stranger for a phone
 * number. Each step is small enough to answer without reading ahead, and going
 * back never costs an answer — the state lives above the steps, and closing the
 * dialog keeps it, so a mistap does not wipe what was typed (§6.3).
 */
export function LeadWizard({
  open,
  onClose,
  address,
  point,
  spots,
  ownerKind,
  rateGr,
  annualNetGr,
}: {
  open: boolean;
  onClose: () => void;
  address: string;
  point: { lat: number; lng: number } | null;
  spots: number;
  ownerKind: OwnerKind;
  rateGr: number;
  annualNetGr: number;
}) {
  const formId = useId();
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const [objectType, setObjectType] = useState<ObjectType | null>(null);
  const [objectName, setObjectName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPreference, setContactPreference] = useState<ContactPreference>("PHONE");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [privacy, setPrivacy] = useState(false);
  const [marketingEmail, setMarketingEmail] = useState(false);
  const [marketingPhone, setMarketingPhone] = useState(false);

  function validate(target: number): FieldErrors {
    const next: FieldErrors = {};
    if (target >= 1 && !objectType) next.objectType = "Wybierz, co udostępniasz.";
    if (target >= 2) {
      if (contactName.trim().length < 2) next.contactName = "Podaj imię.";
      if (contactPreference === "PHONE" && !phone.trim()) {
        next.phone = "Wybrałeś telefon — podaj numer.";
      }
      if (contactPreference === "EMAIL" && !email.trim()) {
        next.email = "Wybrałeś e-mail — podaj adres.";
      }
    }
    return next;
  }

  function goTo(target: number) {
    // Validate only what lies BEHIND the target, so going back never scolds.
    if (target > step) {
      const found = validate(target);
      setErrors(found);
      if (Object.keys(found).length > 0) return;
    } else {
      setErrors({});
    }
    setStep(target);
  }

  async function submit() {
    const found = validate(2);
    if (!privacy) found.consent = "Bez tej zgody nie możemy przetwarzać Twoich danych.";
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // The offending field may be on an earlier step — take the user there.
      if (found.objectType) setStep(0);
      else if (found.contactName || found.phone || found.email) setStep(1);
      return;
    }

    setPending(true);
    setFormError(null);
    try {
      const res = await fetch("/api/dla-wlascicieli/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectName: objectName.trim() || undefined,
          address,
          lat: point?.lat,
          lng: point?.lng,
          objectType: objectType ?? undefined,
          spots,
          ownerKind,
          contactName: contactName.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          contactPreference,
          privacyConsent: true,
          marketingEmailConsent: marketingEmail,
          marketingPhoneConsent: marketingPhone,
          website,
          source: "dla-wlascicieli",
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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < STEPS.length - 1) goTo(step + 1);
    else void submit();
  }

  if (done) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title="Dzięki. Odezwiemy się."
        className="max-w-[34rem]"
        actions={
          <Button variant="accent" onClick={onClose}>
            Zamknij
          </Button>
        }
      >
        <p className="text-body text-muted">
          To nie było zobowiązanie — po prostu porozmawiamy o Twoim miejscu. Zwykle kontaktujemy się
          w ciągu kilku dni roboczych
          {contactPreference === "PHONE" ? " telefonicznie" : " mailem"}.
        </p>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Porozmawiajmy o Twoim miejscu"
      className="max-w-[34rem]"
      actions={
        <>
          {step > 0 ? (
            <Button variant="ghost" onClick={() => goTo(step - 1)} disabled={pending}>
              Wstecz
            </Button>
          ) : null}
          <Button type="submit" form={formId} variant="accent" loading={pending}>
            {step < STEPS.length - 1 ? "Dalej" : "Wyślij zgłoszenie"}
          </Button>
        </>
      }
    >
      <Stepper step={step} onGoTo={goTo} />

      <form id={formId} onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-5">
        {formError ? (
          <p
            role="alert"
            className="rounded-card border border-danger bg-danger-soft px-3 py-2 text-ui text-danger"
          >
            {formError}
          </p>
        ) : null}

        {step === 0 ? (
          <fieldset>
            <legend className="text-h3 font-semibold text-ink">Co udostępniasz?</legend>
            <p className="mt-1 text-ui text-muted">Jedna odpowiedź. Szczegóły dopytamy później.</p>

            <div className="mt-4 flex flex-col gap-2">
              {OBJECT_TYPES.map((type) => (
                <OptionRow
                  key={type.value}
                  name="objectType"
                  checked={objectType === type.value}
                  onSelect={() => {
                    setObjectType(type.value);
                    setErrors((prev) => ({ ...prev, objectType: undefined }));
                  }}
                  label={type.label}
                  hint={type.hint}
                />
              ))}
            </div>
            {errors.objectType ? (
              <p role="alert" className="mt-2 text-ui text-danger">
                {errors.objectType}
              </p>
            ) : null}

            <div className="mt-5">
              <Field label="Nazwa obiektu">
                {(field) => (
                  <Input
                    {...field}
                    value={objectName}
                    onChange={(event) => setObjectName(event.target.value)}
                    placeholder="np. parking warsztatu przy Grunwaldzkiej"
                  />
                )}
              </Field>
            </div>
          </fieldset>
        ) : null}

        {step === 1 ? (
          <>
            <Field label="Imię" required error={errors.contactName}>
              {(field) => (
                <Input
                  {...field}
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  autoComplete="given-name"
                  placeholder="Jan"
                />
              )}
            </Field>

            <fieldset>
              <legend className="text-ui font-semibold text-ink">Jak się skontaktować?</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(["PHONE", "EMAIL"] as ContactPreference[]).map((pref) => (
                  <OptionRow
                    key={pref}
                    name="contactPreference"
                    checked={contactPreference === pref}
                    onSelect={() => setContactPreference(pref)}
                    label={pref === "PHONE" ? "Telefon" : "E-mail"}
                    hint={pref === "PHONE" ? "Zadzwonimy" : "Napiszemy"}
                  />
                ))}
              </div>
            </fieldset>

            {/* Both channels stay available — only the chosen one is required.
                Hiding the other would force a step back to add it. */}
            <Field
              label="Telefon"
              required={contactPreference === "PHONE"}
              error={errors.phone}
            >
              {(field) => (
                <Input
                  {...field}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="600 100 200"
                />
              )}
            </Field>

            <Field label="E-mail" required={contactPreference === "EMAIL"} error={errors.email}>
              {(field) => (
                <Input
                  {...field}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  placeholder="jan@przyklad.pl"
                />
              )}
            </Field>
          </>
        ) : null}

        {step === 2 ? (
          <>
            {/* Recognition over recall (§6.5): the numbers the calculator worked
                out are restated here, so nobody has to remember what they set. */}
            {/* Out of the calculator's reach there is no rate and no estimate;
                restating them as "0 zł" would be a made-up number, not a recap. */}
            <dl className="rounded-card border border-line bg-surface-2 p-4 text-ui">
              <Summary term="Adres" value={address || "wskazany punkt na mapie"} />
              <Summary term="Miejsca" value={formatSpots(spots)} />
              {rateGr > 0 ? (
                <Summary term="Stawka" value={`${formatMoney(rateGr)} / wydarzenie`} />
              ) : null}
              {annualNetGr > 0 ? (
                <Summary term="Szacunek roczny" value={formatMoney(annualNetGr)} emphasis />
              ) : null}
            </dl>

            <div className="flex flex-col gap-2">
              <Checkbox
                checked={privacy}
                onChange={(event) => {
                  setPrivacy(event.target.checked);
                  setErrors((prev) => ({ ...prev, consent: undefined }));
                }}
                label={
                  <span>
                    Zgadzam się na przetwarzanie moich danych, żeby Parkownia mogła się ze mną
                    skontaktować, zgodnie z{" "}
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
              Administrator danych: Jakub Bilski, ul. Krótka 10a, Mosina. Dane przetwarzamy, by się z
              Tobą skontaktować; masz prawo dostępu, sprostowania i usunięcia — napisz na
              kontakt@parkownia.com.
            </p>
          </>
        ) : null}

        {/* Honeypot: off-screen (not display:none — some bots skip hidden fields),
            aria-hidden and out of the tab order. A filled value → the server drops it. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[-9999px] h-0 w-0 overflow-hidden"
        >
          <label>
            Nie wypełniaj tego pola
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </label>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * A full-width row, not a 20px dot: the target is the whole option (§6.6), and
 * the native radio stays in the DOM under sr-only so keyboard, form semantics
 * and screen readers keep working. Selected state is the neutral inversion —
 * the accent is not a UI state (§4).
 */
function OptionRow({
  name,
  checked,
  onSelect,
  label,
  hint,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  label: string;
  hint: string;
}) {
  return (
    <label
      className={cn(
        "flex min-h-touch cursor-pointer items-start gap-3 rounded-button border p-3",
        "transition-[border-color,box-shadow,background-color] duration-micro ease-out",
        "focus-within:border-focus focus-within:shadow-[0_0_0_3px_var(--focus-ring)]",
        checked
          ? "border-ink bg-surface-2"
          : "border-line bg-surface hover-hover:hover:border-muted",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-pill border",
          checked ? "border-selected bg-selected text-selected-ink" : "border-line",
        )}
      >
        {checked ? <Check size={12} strokeWidth={3} /> : null}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-body text-ink">{label}</span>
        <span className="text-ui text-muted">{hint}</span>
      </span>
    </label>
  );
}

function Summary({
  term,
  value,
  emphasis,
}: {
  term: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-1.5 last:border-b-0 last:pb-0 first:pt-0">
      <dt className="text-muted">{term}</dt>
      <dd
        className={cn(
          "truncate text-right tabular-nums text-ink",
          emphasis && "font-semibold",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * Completed steps are clickable — a stepper the user cannot walk back is a
 * progress bar with extra steps. Forward jumps stay closed: goTo() validates.
 */
function Stepper({ step, onGoTo }: { step: number; onGoTo: (n: number) => void }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((label, index) => {
        const state = index < step ? "done" : index === step ? "current" : "todo";
        return (
          <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
            <button
              type="button"
              onClick={() => (state === "done" ? onGoTo(index) : undefined)}
              disabled={state !== "done"}
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-button py-1 text-ui",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                state === "done" && "cursor-pointer",
              )}
            >
              {/* State is carried by shape and glyph as well as by weight — never
                  by colour alone (§4). */}
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-pill border text-ui font-semibold tabular-nums",
                  state === "done" && "border-selected bg-selected text-selected-ink",
                  state === "current" && "border-ink text-ink",
                  state === "todo" && "border-line text-muted",
                )}
              >
                {state === "done" ? (
                  <Check size={14} strokeWidth={3} aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cn(
                  "hidden sm:inline",
                  state === "current" ? "font-semibold text-ink" : "text-muted",
                )}
              >
                {label}
              </span>
              <span className="sr-only">
                Krok {index + 1} z {STEPS.length}: {label}
              </span>
            </button>
            {index < STEPS.length - 1 ? (
              <span aria-hidden="true" className="h-px flex-1 bg-line" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
