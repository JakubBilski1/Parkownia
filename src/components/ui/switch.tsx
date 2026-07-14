"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

export type SwitchProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "role"
> & {
  label: React.ReactNode;
  hint?: React.ReactNode;
};

/**
 * A checkbox with role="switch": used for instant, optimistic toggles
 * ("udostępniam parking na ten mecz"), so it must never wait for the server.
 */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { className, label, hint, id, disabled, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;

  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <label
        htmlFor={inputId}
        className={cn(
          "flex min-h-touch cursor-pointer flex-col justify-center text-body text-ink",
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

      <span className="relative inline-flex h-touch shrink-0 items-center">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          role="switch"
          disabled={disabled}
          aria-describedby={hintId}
          className={cn(
            "peer h-7 w-12 cursor-pointer appearance-none rounded-pill border border-line bg-surface-2",
            "transition-colors duration-micro ease-out",
            "checked:border-selected checked:bg-selected",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
          {...props}
        />
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-1 h-5 w-5 rounded-pill bg-ink",
            "transition-transform duration-micro ease-out",
            "peer-checked:translate-x-5 peer-checked:bg-selected-ink",
          )}
        />
      </span>
    </div>
  );
});
