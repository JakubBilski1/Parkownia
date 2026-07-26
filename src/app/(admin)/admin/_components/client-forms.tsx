"use client";

import { Copy, KeyRound, Trash2, UserPlus } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { IDLE, type ActionResult } from "../action-result";
import {
  createClientAction,
  createEmployeeAction,
  deleteClientAction,
  deleteEmployeeAction,
  resetPasswordAction,
  updateClientAction,
} from "../actions";
import { FieldError, SubmitButton, useActionToast } from "./action-form";

/**
 * The temporary password, shown once and only here. It stays on screen until the
 * operator dismisses it — a toast would take a credential away after four seconds,
 * and there is no second chance to read it: only the hash is stored.
 */
function SecretBox({ state, onDismiss }: { state: ActionResult; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  if (state.status !== "ok" || !state.secret) return null;

  return (
    <div className="flex flex-col gap-2 rounded-card border border-accent bg-surface p-4">
      <p className="text-ui font-semibold text-ink">{state.secret.label}</p>
      <p className="num select-all font-mono text-lead font-semibold text-ink">
        {state.secret.value}
      </p>
      <p className="text-ui text-muted">
        Przekaż je klientowi telefonicznie. Nie zapiszemy go nigdzie drugi raz — jeśli zginie,
        wygeneruj nowe.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="quiet"
          size="sm"
          onClick={() => {
            const value = state.status === "ok" ? state.secret?.value : undefined;
            if (!value) return;
            // Clipboard can be denied (insecure context, no permission) — the
            // number is selectable above either way, so a failure is not fatal.
            navigator.clipboard
              ?.writeText(value)
              .then(() => setCopied(true))
              .catch(() => setCopied(false));
          }}
        >
          <Copy size={16} aria-hidden="true" />
          {copied ? "Skopiowane" : "Kopiuj"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Zapisałem, ukryj
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* New client                                                                 */
/* -------------------------------------------------------------------------- */

export function CreateClientDialog() {
  const [state, formAction] = useActionState(createClientAction, IDLE);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"INDIVIDUAL" | "BUSINESS">("BUSINESS");
  const [secretVisible, setSecretVisible] = useState(false);

  useActionToast(state, () => {
    setOpen(false);
    setSecretVisible(true);
  });

  const errors = state.status === "error" ? state.fields : undefined;

  return (
    <div className="flex flex-col gap-4">
      <Button variant="accent" onClick={() => setOpen(true)}>
        <UserPlus size={16} aria-hidden="true" />
        Dodaj klienta
      </Button>

      {secretVisible ? (
        <SecretBox state={state} onDismiss={() => setSecretVisible(false)} />
      ) : null}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Nowy klient"
        description="Zakładasz konto, którym klient się loguje. Hasło tymczasowe pokażemy raz — przekaż je telefonicznie."
      >
        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <label htmlFor="client-kind" className="mb-1 block text-ui font-semibold text-ink">
              Typ klienta
            </label>
            <Select
              id="client-kind"
              name="kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as "INDIVIDUAL" | "BUSINESS")}
            >
              <option value="BUSINESS">Firma</option>
              <option value="INDIVIDUAL">Osoba prywatna</option>
            </Select>
            <p className="mt-1 text-ui text-muted">
              {kind === "BUSINESS"
                ? "Prowizja 30%. Potrzebny NIP i nazwa do faktury."
                : "Prowizja 50%. Bez NIP-u."}
            </p>
          </div>

          <Field label="E-mail" required error={errors?.email}>
            {(field) => (
              <Input {...field} name="email" type="email" autoComplete="off" placeholder="jan@firma.pl" />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Imię" error={errors?.firstName}>
              {(field) => <Input {...field} name="firstName" placeholder="Jan" />}
            </Field>
            <Field label="Nazwisko" error={errors?.lastName}>
              {(field) => <Input {...field} name="lastName" placeholder="Kowalski" />}
            </Field>
          </div>

          <Field label="Telefon" hint="Numer, pod który dzwonisz w sprawie wjazdu." error={errors?.phone}>
            {(field) => <Input {...field} name="phone" type="tel" placeholder="600 100 200" />}
          </Field>

          {kind === "BUSINESS" ? (
            <>
              <Field label="Nazwa firmy" required error={errors?.companyName}>
                {(field) => <Input {...field} name="companyName" placeholder="Warsztat Kowalski sp. z o.o." />}
              </Field>
              <Field label="NIP" required hint="10 cyfr. Spacje i myślniki możesz zostawić." error={errors?.nip}>
                {(field) => <Input {...field} name="nip" inputMode="numeric" placeholder="7792445138" />}
              </Field>
              <Field label="Adres" error={errors?.address}>
                {(field) => <Input {...field} name="address" placeholder="ul. Grunwaldzka 10, Poznań" />}
              </Field>
            </>
          ) : null}

          <FieldError message={errors?._} />

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Anuluj
            </Button>
            <SubmitButton variant="accent">Utwórz konto</SubmitButton>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Editing a client                                                          */
/* -------------------------------------------------------------------------- */

export function ClientEditForm({
  clientId,
  firstName,
  lastName,
  phone,
  companyName,
  address,
  isBusiness,
}: {
  clientId: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  companyName: string | null;
  address: string | null;
  isBusiness: boolean;
}) {
  const [state, formAction] = useActionState(updateClientAction, IDLE);
  useActionToast(state);

  const errors = state.status === "error" ? state.fields : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="clientId" value={clientId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Imię" error={errors?.firstName}>
          {(field) => <Input {...field} name="firstName" defaultValue={firstName ?? ""} />}
        </Field>
        <Field label="Nazwisko" error={errors?.lastName}>
          {(field) => <Input {...field} name="lastName" defaultValue={lastName ?? ""} />}
        </Field>
      </div>

      <Field label="Telefon" hint="Wyczyść pole, żeby usunąć numer." error={errors?.phone}>
        {(field) => (
          <Input {...field} name="phone" type="tel" defaultValue={phone ?? ""} placeholder="600 100 200" />
        )}
      </Field>

      {isBusiness ? (
        <>
          <Field label="Nazwa firmy" error={errors?.companyName}>
            {(field) => <Input {...field} name="companyName" defaultValue={companyName ?? ""} />}
          </Field>
          <Field label="Adres" error={errors?.address}>
            {(field) => <Input {...field} name="address" defaultValue={address ?? ""} />}
          </Field>
        </>
      ) : null}

      <div className="flex justify-end">
        <SubmitButton variant="accent">Zapisz dane</SubmitButton>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* New password                                                               */
/* -------------------------------------------------------------------------- */

export function ResetPasswordButton({
  accountId,
  clientId,
  label,
}: {
  accountId: string;
  clientId: string;
  label: string;
}) {
  const [state, formAction] = useActionState(resetPasswordAction, IDLE);
  const [asking, setAsking] = useState(false);
  const [secretVisible, setSecretVisible] = useState(false);

  useActionToast(state, () => {
    setAsking(false);
    setSecretVisible(true);
  });

  return (
    <div className="flex flex-col gap-3">
      <Button variant="quiet" size="sm" onClick={() => setAsking(true)}>
        <KeyRound size={16} aria-hidden="true" />
        Nowe hasło
      </Button>

      {secretVisible ? (
        <SecretBox state={state} onDismiss={() => setSecretVisible(false)} />
      ) : null}

      <Dialog
        open={asking}
        onClose={() => setAsking(false)}
        title="Wygenerować nowe hasło?"
        description={`${label} zostanie wylogowany ze wszystkich urządzeń, a stare hasło przestanie działać. Nowe pokażemy raz.`}
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="accountId" value={accountId} />
          <input type="hidden" name="clientId" value={clientId} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setAsking(false)}>
              Anuluj
            </Button>
            <SubmitButton variant="accent">Generuj hasło</SubmitButton>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Employees                                                                  */
/* -------------------------------------------------------------------------- */

export function CreateEmployeeDialog({ clientId }: { clientId: string }) {
  const [state, formAction] = useActionState(createEmployeeAction, IDLE);
  const [open, setOpen] = useState(false);
  const [secretVisible, setSecretVisible] = useState(false);

  useActionToast(state, () => {
    setOpen(false);
    setSecretVisible(true);
  });

  const errors = state.status === "error" ? state.fields : undefined;

  return (
    <div className="flex flex-col gap-4">
      <Button variant="quiet" onClick={() => setOpen(true)}>
        <UserPlus size={16} aria-hidden="true" />
        Dodaj pracownika
      </Button>

      {secretVisible ? (
        <SecretBox state={state} onDismiss={() => setSecretVisible(false)} />
      ) : null}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Nowe konto pracownika"
        description="Pracownik widzi skaner i listę rezerwacji tego klienta. Nie widzi cen, wypłat ani formularza parkingu."
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="clientId" value={clientId} />

          <Field label="E-mail" required error={errors?.email}>
            {(field) => (
              <Input {...field} name="email" type="email" autoComplete="off" placeholder="brama@firma.pl" />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Imię" error={errors?.firstName}>
              {(field) => <Input {...field} name="firstName" placeholder="Marek" />}
            </Field>
            <Field label="Nazwisko" error={errors?.lastName}>
              {(field) => <Input {...field} name="lastName" placeholder="Portier" />}
            </Field>
          </div>

          <Field label="Telefon" error={errors?.phone}>
            {(field) => <Input {...field} name="phone" type="tel" placeholder="600 100 200" />}
          </Field>

          <FieldError message={errors?._} />

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Anuluj
            </Button>
            <SubmitButton variant="accent">Utwórz konto</SubmitButton>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

export function DeleteEmployeeButton({
  employeeId,
  clientId,
  label,
}: {
  employeeId: string;
  clientId: string;
  label: string;
}) {
  const [state, formAction] = useActionState(deleteEmployeeAction, IDLE);
  const [asking, setAsking] = useState(false);

  useActionToast(state, () => setAsking(false));

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setAsking(true)}>
        <Trash2 size={16} aria-hidden="true" />
        Wyłącz
      </Button>

      <Dialog
        open={asking}
        onClose={() => setAsking(false)}
        title="Wyłączyć to konto?"
        description={`${label} straci dostęp do skanera od razu. Dane osobowe zostaną nadpisane. Klient i jego parkingi zostają.`}
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="employeeId" value={employeeId} />
          <input type="hidden" name="clientId" value={clientId} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setAsking(false)}>
              Anuluj
            </Button>
            <SubmitButton variant="danger">Wyłącz konto</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Removing a client                                                          */
/* -------------------------------------------------------------------------- */

export function DeleteClientButton({ clientId, label }: { clientId: string; label: string }) {
  const [state, formAction] = useActionState(deleteClientAction, IDLE);
  const [asking, setAsking] = useState(false);

  useActionToast(state, () => setAsking(false));

  return (
    <>
      <Button variant="danger" onClick={() => setAsking(true)}>
        <Trash2 size={16} aria-hidden="true" />
        Usuń klienta
      </Button>

      <Dialog
        open={asking}
        onClose={() => setAsking(false)}
        title={`Usunąć ${label}?`}
        description="Dane osobowe zostaną nadpisane, konta pracowników wyłączone, a parkingi wstrzymane i oznaczone. Rezerwacje, płatności i prowizje zostają — wymaga tego księgowość. Nie da się tego cofnąć."
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="clientId" value={clientId} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setAsking(false)}>
              Anuluj
            </Button>
            <SubmitButton variant="danger">Usuń klienta</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
