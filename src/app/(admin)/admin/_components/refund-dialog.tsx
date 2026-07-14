"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";
import { IDLE } from "../action-result";
import { refundAction } from "../actions";
import { FieldError, SubmitButton, useActionToast } from "./action-form";

/**
 * The split (how much the platform gives back, how much the host does) is never
 * computed here — money is a server concern. The dialog states the rule; the
 * toast reports the exact figures the server actually applied.
 */
export function RefundDialog({
  bookingId,
  code,
  refundableGr,
}: {
  bookingId: string;
  code: string;
  refundableGr: number;
}) {
  const [state, formAction] = useActionState(refundAction, IDLE);
  const [open, setOpen] = useState(false);

  useActionToast(state, () => setOpen(false));

  const amountError = state.status === "error" ? state.fields?.amountGr : undefined;

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        Zwróć
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Zwrot za ${code}`}
        description={`Do zwrotu zostało ${formatMoney(refundableGr)}. Zwrot pomniejsza prowizję platformy i wypłatę hosta proporcjonalnie.`}
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="bookingId" value={bookingId} />

          <Field
            label="Kwota zwrotu"
            hint="Puste pole = zwrot całej pozostałej kwoty."
          >
            {(props) => (
              <Input
                {...props}
                name="amountZl"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                max={(refundableGr / 100).toFixed(2)}
                placeholder={(refundableGr / 100).toFixed(2)}
                suffix="zł"
              />
            )}
          </Field>

          <FieldError message={amountError} />

          <p className="text-ui text-muted">
            Pieniądze wracają na kartę lub konto kierowcy. Operacji nie da się cofnąć.
          </p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Nie zwracaj
            </Button>
            <SubmitButton variant="danger">Zwróć pieniądze</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
