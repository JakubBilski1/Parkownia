"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";
import { IDLE } from "../action-result";
import { generatePayoutsAction, markPaidAction } from "../actions";
import { FieldError, SubmitButton, useActionToast } from "./action-form";

export function GeneratePayoutsForm({
  defaultStart,
  defaultEnd,
}: {
  defaultStart: string;
  defaultEnd: string;
}) {
  const [state, formAction] = useActionState(generatePayoutsAction, IDLE);
  useActionToast(state);

  const error = state.status === "error" ? state.fields?.periodEnd : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Okres od" required className="w-40">
          {(props) => (
            <Input {...props} name="periodStart" type="date" defaultValue={defaultStart} />
          )}
        </Field>
        <Field label="Okres do" required className="w-40">
          {(props) => <Input {...props} name="periodEnd" type="date" defaultValue={defaultEnd} />}
        </Field>
        <SubmitButton variant="accent">Utwórz wypłaty</SubmitButton>
      </div>

      <FieldError message={error} />

      <p className="max-w-prose text-ui text-muted">
        Bierzemy każdą opłaconą rezerwację, która skończyła się przed końcem okresu i nie została
        jeszcze rozliczona — także zaległe z wcześniejszych tygodni. Ponowne uruchomienie nie
        zapłaci nikomu dwa razy.
      </p>
    </form>
  );
}

export function MarkPaidDialog({
  payoutId,
  hostLabel,
  amountGr,
}: {
  payoutId: string;
  hostLabel: string;
  amountGr: number;
}) {
  const [state, formAction] = useActionState(markPaidAction, IDLE);
  const [open, setOpen] = useState(false);

  useActionToast(state, () => setOpen(false));

  const error = state.status === "error" ? state.fields?.providerRef : undefined;

  return (
    <>
      <Button variant="accent" size="sm" onClick={() => setOpen(true)}>
        Oznacz jako wypłacone
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Potwierdź wypłatę"
        description={`Zaznaczasz, że ${hostLabel} dostał ${formatMoney(amountGr)}. Zrób to dopiero po wysłaniu przelewu.`}
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="payoutId" value={payoutId} />

          <Field
            label="Numer przelewu"
            required
            hint="Referencja z banku. Po niej odnajdziesz tę wypłatę przy reklamacji."
          >
            {(props) => <Input {...props} name="providerRef" autoComplete="off" />}
          </Field>

          <FieldError message={error} />

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Anuluj
            </Button>
            <SubmitButton variant="accent">Potwierdzam wypłatę</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
