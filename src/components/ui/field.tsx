"use client";

import { AlertCircle } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/cn";

export type FieldControlProps = {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": boolean | undefined;
  required: boolean | undefined;
};

export type FieldProps = {
  label: React.ReactNode;
  /** Explains the constraint before the user hits it (Nielsen: prevent, don't scold). */
  hint?: React.ReactNode;
  /** What happened, in Polish, in the active voice. Rendered as a live region. */
  error?: string;
  required?: boolean;
  className?: string;
  /** The control receives the id and aria wiring — the label is always attached. */
  children: (props: FieldControlProps) => React.ReactNode;
};

export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-ui font-semibold text-ink">
        {label}
        {required ? (
          <span className="ml-1 text-muted" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ml-1 font-normal text-muted">(opcjonalne)</span>
        )}
      </label>

      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        required,
      })}

      {hint && !error ? (
        <p id={hintId} className="text-ui text-muted">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-ui text-danger"
        >
          <AlertCircle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
