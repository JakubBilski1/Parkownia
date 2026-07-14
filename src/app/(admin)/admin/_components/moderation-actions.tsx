"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "../action-result";
import { reviewParkingAction } from "../actions";
import { FieldError, SubmitButton, useActionToast } from "./action-form";

/**
 * Approve and reject are deliberately far apart (DESIGN_PRINCIPLES §6.6) and
 * reject costs a second step: the host gets the reason in an e-mail, so it has
 * to be written by a human who meant it.
 */
export function ModerationActions({
  parkingId,
  title,
}: {
  parkingId: string;
  title: string;
}) {
  const [state, formAction] = useActionState(reviewParkingAction, IDLE);
  const [rejecting, setRejecting] = useState(false);

  useActionToast(state, () => setRejecting(false));

  const reasonError = state.status === "error" ? state.fields?.reason : undefined;

  return (
    <div className="flex w-full items-center justify-between gap-3">
      <Button variant="danger" onClick={() => setRejecting(true)}>
        Odrzuć
      </Button>

      <form action={formAction}>
        <input type="hidden" name="parkingId" value={parkingId} />
        <input type="hidden" name="decision" value="ACTIVE" />
        <SubmitButton variant="accent">Zatwierdź</SubmitButton>
      </form>

      <Dialog
        open={rejecting}
        onClose={() => setRejecting(false)}
        title="Odrzuć parking"
        description={`Host dostanie ten powód w mailu. Napisz, co konkretnie ma poprawić w „${title}”.`}
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="parkingId" value={parkingId} />
          <input type="hidden" name="decision" value="REJECTED" />

          <Field
            label="Powód odrzucenia"
            required
            hint="Np. „Zdjęcia nie pokazują wjazdu. Dodaj zdjęcie bramy od ul. Górczyńskiej.”"
          >
            {(props) => (
              <Textarea
                {...props}
                name="reason"
                rows={4}
                maxLength={1000}
                placeholder="Co host ma poprawić?"
              />
            )}
          </Field>

          <FieldError message={reasonError} />

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setRejecting(false)}>
              Anuluj
            </Button>
            <SubmitButton variant="danger">Odrzuć i wyślij powód</SubmitButton>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
