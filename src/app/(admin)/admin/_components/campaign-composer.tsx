"use client";

import { AlertTriangle, Check, HelpCircle, Send, Users } from "lucide-react";
import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "../action-result";
import { sendCampaignAction } from "../actions";
import { FieldError, SubmitButton, useActionToast } from "./action-form";
import { CampaignPreview } from "./campaign-preview";

type Consent = "GRANTED" | "MISSING" | "UNKNOWN";

type Recipient = {
  email: string;
  name: string | null;
  consent: Consent;
  source: "lead" | "user" | null;
};

type CheckResult = {
  recipients: Recipient[];
  invalid: string[];
  duplicates: number;
  truncated: boolean;
  counts: {
    total: number;
    granted: number;
    missing: number;
    unknown: number;
    /** Already unsubscribed. Dropped at send time whatever the operator ticks. */
    suppressed: number;
  };
};

const CONSENT_LABEL: Record<Consent, string> = {
  GRANTED: "zgoda w bazie",
  MISSING: "brak zgody",
  UNKNOWN: "nieznany",
};

const CONSENT_TONE: Record<Consent, "ok" | "bad" | "muted"> = {
  GRANTED: "ok",
  MISSING: "bad",
  UNKNOWN: "muted",
};

const CONSENT_ICON: Record<Consent, typeof Check> = {
  GRANTED: Check,
  MISSING: AlertTriangle,
  UNKNOWN: HelpCircle,
};

const EXAMPLE = `[
  { "email": "kontakt@warsztat-kowalski.pl", "name": "Jan Kowalski" },
  { "email": "biuro@plac-bulgarska.pl" },
  "portiernia@osiedle-lazarz.pl"
]`;

export function CampaignComposer({ maxRecipients }: { maxRecipients: number }) {
  const [state, formAction] = useActionState(sendCampaignAction, IDLE);

  const [recipientsJson, setRecipientsJson] = useState("");
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const [subject, setSubject] = useState("Twój parking stoi pusty w dzień meczu");
  const [preheader, setPreheader] = useState("");
  const [heading, setHeading] = useState("Zarabiaj na miejscu, które i tak stoi puste");
  const [body, setBody] = useState(
    "W dni meczowe pod Enea Stadionem brakuje miejsc do parkowania, a kierowcy szukają ich na kilka dni przed gwizdkiem.\n\nJeśli macie plac, podjazd albo parking firmowy w okolicy, możecie go udostępnić tylko na te kilka godzin. Kierowca rezerwuje i płaci z góry, Wy wpuszczacie go na kod z telefonu.\n\nBez gotówki, bez negocjacji i bez telefonów od klientów. Policzcie sami, ile to może dać — kalkulator na stronie liczy dojście do stadionu i liczbę wydarzeń w zasięgu.",
  );
  const [ctaLabel, setCtaLabel] = useState("Policz swój zarobek");
  const [ctaUrl, setCtaUrl] = useState("https://parkownia.com/");
  const [consentOverride, setConsentOverride] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useActionToast(state, () => setConfirming(false));

  const errors = state.status === "error" ? state.fields : undefined;
  const paragraphs = splitPreview(body);
  const withoutConsent = check ? check.counts.missing + check.counts.unknown : 0;
  // What will actually leave. The unsubscribed are subtracted on the server no
  // matter what is ticked here, so the button may not promise to reach them.
  const willSend = check ? check.counts.total - check.counts.suppressed : 0;
  const canSend = Boolean(check && willSend > 0 && (withoutConsent === 0 || consentOverride));

  async function runCheck() {
    setChecking(true);
    setCheckError(null);
    try {
      const response = await fetch("/api/admin/campaigns/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientsJson }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setCheck(null);
        setCheckError(payload?.error?.message ?? "Nie udało się sprawdzić listy.");
        return;
      }
      setCheck(payload as CheckResult);
    } catch {
      setCheck(null);
      setCheckError("Nie udało się sprawdzić listy. Sprawdź połączenie i spróbuj ponownie.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="flex flex-col gap-6">
        {/* ---------------------------------------------------------- adresaci */}
        <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
          <div>
            <h2 className="font-display text-h3 font-bold text-ink">1. Adresaci</h2>
            <p className="text-ui text-muted">
              Wklej JSON: tablicę adresów albo obiektów z polami <code className="font-mono">email</code>{" "}
              i <code className="font-mono">name</code>. Maksimum {maxRecipients} adresów na jedną
              wysyłkę. Duplikaty scalimy sami.
            </p>
          </div>

          <Textarea
            value={recipientsJson}
            onChange={(event) => setRecipientsJson(event.target.value)}
            rows={7}
            spellCheck={false}
            className="font-mono text-ui"
            placeholder={EXAMPLE}
            aria-label="Lista adresatów w formacie JSON"
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="quiet"
              onClick={runCheck}
              loading={checking}
              disabled={recipientsJson.trim().length < 2}
            >
              <Users size={16} aria-hidden="true" />
              Sprawdź listę
            </Button>
            {check ? (
              <p className="text-ui text-muted">
                {check.counts.total} adresatów ·{" "}
                <span className="text-ink">{check.counts.granted} ze zgodą</span> ·{" "}
                {check.counts.missing} bez zgody · {check.counts.unknown} nieznanych
                {check.counts.suppressed > 0 ? (
                  <>
                    {" · "}
                    <span className="text-danger">
                      {check.counts.suppressed} wypisanych — nie pójdzie
                    </span>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>

          {checkError ? (
            <p role="alert" className="rounded-card border border-danger bg-danger-soft px-3 py-2 text-ui text-danger">
              {checkError}
            </p>
          ) : null}

          {check?.truncated ? (
            <p role="alert" className="text-ui text-danger">
              Lista jest dłuższa niż {maxRecipients} adresów — pokazuję i wyślę tylko pierwsze{" "}
              {maxRecipients}. Podziel ją na części.
            </p>
          ) : null}

          {check && check.duplicates > 0 ? (
            <p className="text-ui text-muted">
              Scalono {check.duplicates} powtórzonych adresów — nikt nie dostanie maila dwa razy.
            </p>
          ) : null}

          {check && check.invalid.length > 0 ? (
            <div className="rounded-card border border-danger bg-danger-soft p-3">
              <p className="text-ui font-semibold text-danger">
                {check.invalid.length} wpisów nie umiem odczytać jako adresu:
              </p>
              <ul className="mt-1 list-inside list-disc text-ui text-danger">
                {check.invalid.slice(0, 8).map((entry, index) => (
                  <li key={index} className="font-mono">
                    {entry}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {check && check.recipients.length > 0 ? (
            <div className="max-h-72 overflow-y-auto rounded-card border border-line">
              <table className="w-full border-collapse text-left text-ui">
                <tbody>
                  {check.recipients.map((recipient) => {
                    const Icon = CONSENT_ICON[recipient.consent];
                    return (
                      <tr key={recipient.email} className="border-b border-line last:border-0">
                        <td className="px-3 py-2 text-ink">
                          {recipient.email}
                          {recipient.name ? (
                            <span className="text-muted"> · {recipient.name}</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Badge icon={Icon} tone={CONSENT_TONE[recipient.consent]}>
                            {CONSENT_LABEL[recipient.consent]}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        {/* -------------------------------------------------------------- treść */}
        <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 shadow-card">
          <div>
            <h2 className="font-display text-h3 font-bold text-ink">2. Treść</h2>
            <p className="text-ui text-muted">
              Zwykły tekst. Pusta linia zaczyna nowy akapit, maksimum sześć akapitów. HTML-a nie
              wstawiamy — szablon sam opakuje to, co napiszesz.
            </p>
          </div>

          <Field label="Temat" required error={errors?.subject}>
            {(field) => (
              <Input
                {...field}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                maxLength={160}
              />
            )}
          </Field>

          <Field
            label="Podtytuł w skrzynce"
            hint="Szara linia obok tematu. Puste — weźmiemy początek pierwszego akapitu."
            error={errors?.preheader}
          >
            {(field) => (
              <Input
                {...field}
                value={preheader}
                onChange={(event) => setPreheader(event.target.value)}
                maxLength={200}
              />
            )}
          </Field>

          <Field label="Nagłówek w mailu" required error={errors?.heading}>
            {(field) => (
              <Input
                {...field}
                value={heading}
                onChange={(event) => setHeading(event.target.value)}
                maxLength={120}
              />
            )}
          </Field>

          <Field label="Treść" required error={errors?.body}>
            {(field) => (
              <Textarea
                {...field}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={12}
                maxLength={6000}
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Napis na przycisku" error={errors?.ctaLabel}>
              {(field) => (
                <Input
                  {...field}
                  value={ctaLabel}
                  onChange={(event) => setCtaLabel(event.target.value)}
                  maxLength={40}
                />
              )}
            </Field>
            <Field label="Adres przycisku" hint="Pełny URL, z https://." error={errors?.ctaUrl}>
              {(field) => (
                <Input
                  {...field}
                  value={ctaUrl}
                  onChange={(event) => setCtaUrl(event.target.value)}
                  inputMode="url"
                />
              )}
            </Field>
          </div>

          {paragraphs.length > 6 ? (
            <p role="alert" className="text-ui text-danger">
              Napisałeś więcej niż sześć akapitów. Szablon ma sześć slotów — nadwyżka nie pójdzie.
            </p>
          ) : null}
        </section>

        {/* -------------------------------------------------------------- wysyłka */}
        <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
          <div>
            <h2 className="font-display text-h3 font-bold text-ink">3. Wysyłka</h2>
            <p className="text-ui text-muted">
              Jeden klik i wiadomość trafia do skrzynek. Nie da się jej wycofać.
            </p>
          </div>

          {withoutConsent > 0 ? (
            <div className="flex flex-col gap-2 rounded-card border border-danger bg-danger-soft p-3">
              <p className="text-ui font-semibold text-danger">
                {withoutConsent} z {check?.counts.total} adresów nie ma u nas zgody marketingowej.
              </p>
              <p className="text-ui text-danger">
                Prawo komunikacji elektronicznej wymaga uprzedniej zgody na marketing e-mailowy,
                także wobec firm. Twoje oświadczenie zapiszemy razem z kampanią.
              </p>
              <Checkbox
                checked={consentOverride}
                onChange={(event) => setConsentOverride(event.target.checked)}
                label={`Oświadczam, że mam podstawę prawną do kontaktu z tymi ${withoutConsent} adresami.`}
              />
            </div>
          ) : null}

          <FieldError message={errors?._} />

          <div>
            <Button variant="accent" size="lg" disabled={!canSend} onClick={() => setConfirming(true)}>
              <Send size={16} aria-hidden="true" />
              {check ? `Wyślij do ${willSend} adresów` : "Najpierw sprawdź listę"}
            </Button>
          </div>
        </section>
      </div>

      {/* ---------------------------------------------------------------- podgląd */}
      <aside className="flex flex-col gap-3 xl:sticky xl:top-4 xl:self-start">
        <h2 className="font-display text-h3 font-bold text-ink">Podgląd</h2>
        <CampaignPreview
          subject={subject}
          preheader={preheader}
          heading={heading}
          paragraphs={paragraphs.slice(0, 6)}
          ctaLabel={ctaLabel}
          ctaUrl={ctaUrl}
          recipientName={check?.recipients[0]?.name ?? null}
        />
      </aside>

      {/* Every field travels with the confirmed submit, so what you saw is what goes. */}
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Wysłać do ${willSend} adresów?`}
        description={
          withoutConsent > 0
            ? `Wśród nich ${withoutConsent} bez zgody marketingowej — zapiszemy Twoje oświadczenie przy tej kampanii. Wiadomości nie da się wycofać.`
            : "Wszystkie adresy mają zgodę w bazie. Wiadomości nie da się wycofać."
        }
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="recipientsJson" value={recipientsJson} />
          <input type="hidden" name="subject" value={subject} />
          <input type="hidden" name="preheader" value={preheader} />
          <input type="hidden" name="heading" value={heading} />
          <input type="hidden" name="body" value={body} />
          <input type="hidden" name="ctaLabel" value={ctaLabel} />
          <input type="hidden" name="ctaUrl" value={ctaUrl} />
          {consentOverride ? <input type="hidden" name="consentOverride" value="on" /> : null}

          <p className="text-ui text-muted">
            Temat: <span className="text-ink">{subject}</span>
          </p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Anuluj
            </Button>
            <SubmitButton variant="accent">Wyślij teraz</SubmitButton>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

/** Mirrors splitParagraphs() on the server — the preview must not drift from the send. */
function splitPreview(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((block) => block.trim().replace(/\s*\n\s*/g, " "))
    .filter((block) => block.length > 0);
}
