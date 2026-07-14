"use client";

import { Check } from "lucide-react";
import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

export type CheckboxProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  label: React.ReactNode;
  hint?: React.ReactNode;
};

/**
 * The native input stays in the DOM (keyboard, forms, screen readers); the box is
 * drawn next to it. Checked state is neutral ink — the accent is not a UI state.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ className, label, hint, id, disabled, ...props }, ref) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const hintId = hint ? `${inputId}-hint` : undefined;

    return (
      <div className={cn("flex items-start gap-3", className)}>
        <span className="relative flex min-h-touch items-center">
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            disabled={disabled}
            aria-describedby={hintId}
            className={cn(
              "peer h-6 w-6 shrink-0 cursor-pointer appearance-none rounded-chip border border-line bg-surface",
              "transition-colors duration-micro ease-out",
              "checked:border-selected checked:bg-selected",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
            {...props}
          />
          <Check
            size={16}
            strokeWidth={3}
            aria-hidden="true"
            className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 text-selected-ink opacity-0 peer-checked:opacity-100"
          />
        </span>
        <label
          htmlFor={inputId}
          className={cn(
            "flex min-h-touch cursor-pointer flex-col justify-center py-1 text-body text-ink",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <span>{label}</span>
          {hint ? (
            <span id={hintId} className="text-ui text-muted">
              {hint}
            </span>
          ) : null}
        </label>
      </div>
    );
  },
);
