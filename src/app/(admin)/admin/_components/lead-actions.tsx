"use client";

import { useActionState } from "react";
import { Select } from "@/components/ui/select";
import { LEAD_STATUS_LABEL } from "@/modules/admin/labels";
import { IDLE } from "../action-result";
import { setLeadStatusAction } from "../actions";
import { SubmitButton, useActionToast } from "./action-form";

/**
 * Where a lead is in the conversation. No money moves, nothing is irreversible
 * and a status gets corrected mid-call — so it is one select and one button, not
 * a confirmation dialog.
 */
export function LeadActions({
  leadId,
  status,
}: {
  leadId: string;
  status: keyof typeof LEAD_STATUS_LABEL;
}) {
  const [state, formAction] = useActionState(setLeadStatusAction, IDLE);

  useActionToast(state);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="leadId" value={leadId} />
      <label className="sr-only" htmlFor={`lead-status-${leadId}`}>
        Status leada
      </label>
      <Select id={`lead-status-${leadId}`} name="status" defaultValue={status}>
        {Object.entries(LEAD_STATUS_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <SubmitButton variant="quiet">Zapisz</SubmitButton>
    </form>
  );
}
