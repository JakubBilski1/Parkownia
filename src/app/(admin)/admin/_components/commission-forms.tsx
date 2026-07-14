"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { IDLE } from "../action-result";
import { deleteCommissionAction, setCommissionAction } from "../actions";
import { FieldError, SubmitButton, useActionToast } from "./action-form";

/** Global rate for one owner type. Saving writes a new version, never an update. */
export function GlobalRateForm({
  scope,
  label,
  currentRate,
}: {
  scope: "GLOBAL_INDIVIDUAL" | "GLOBAL_BUSINESS";
  label: string;
  currentRate: number | null;
}) {
  const [state, formAction] = useActionState(setCommissionAction, IDLE);
  useActionToast(state);

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-card border border-line bg-surface p-4 shadow-card"
    >
      <input type="hidden" name="scope" value={scope} />

      <Field label={label} required className="w-40">
        {(props) => (
          <Input
            {...props}
            name="ratePct"
            type="number"
            inputMode="numeric"
            min="0"
            max="100"
            step="1"
            defaultValue={currentRate ?? ""}
            suffix="%"
          />
        )}
      </Field>

      <SubmitButton variant="accent">Zapisz stawkę</SubmitButton>

      <FieldError message={state.status === "error" ? state.fields?.ratePct : undefined} />
    </form>
  );
}

export function OverrideForm() {
  const [state, formAction] = useActionState(setCommissionAction, IDLE);
  useActionToast(state);

  const fields = state.status === "error" ? state.fields : undefined;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 shadow-card"
    >
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Czego dotyczy" required className="w-48">
          {(props) => (
            <Select {...props} name="scope" defaultValue="USER">
              <option value="USER">Konkretny host</option>
              <option value="PARKING">Konkretny parking</option>
            </Select>
          )}
        </Field>

        <Field
          label="Id hosta"
          hint="Wypełnij przy nadpisaniu dla hosta."
          className="min-w-[16rem] flex-1"
        >
          {(props) => <Input {...props} name="userId" placeholder="uuid" autoComplete="off" />}
        </Field>

        <Field
          label="Id parkingu"
          hint="Wypełnij przy nadpisaniu dla parkingu."
          className="min-w-[16rem] flex-1"
        >
          {(props) => <Input {...props} name="parkingId" placeholder="uuid" autoComplete="off" />}
        </Field>

        <Field label="Stawka" required className="w-32">
          {(props) => (
            <Input
              {...props}
              name="ratePct"
              type="number"
              inputMode="numeric"
              min="0"
              max="100"
              step="1"
              suffix="%"
            />
          )}
        </Field>

        <SubmitButton variant="accent">Dodaj nadpisanie</SubmitButton>
      </div>

      <FieldError message={fields?.userId ?? fields?.parkingId ?? fields?.ratePct} />
    </form>
  );
}

export function DeleteOverrideButton({ ruleId }: { ruleId: string }) {
  const [state, formAction] = useActionState(deleteCommissionAction, IDLE);
  useActionToast(state);

  return (
    <form action={formAction}>
      <input type="hidden" name="ruleId" value={ruleId} />
      <SubmitButton variant="danger" size="sm">
        Usuń
      </SubmitButton>
    </form>
  );
}
