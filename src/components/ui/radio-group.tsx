"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

export type RadioOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  hint?: React.ReactNode;
  disabled?: boolean;
};

export type RadioGroupProps<T extends string> = {
  name: string;
  legend: React.ReactNode;
  options: ReadonlyArray<RadioOption<T>>;
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  className?: string;
};

/**
 * Options are full-width rows, not 20px dots: the user picks them with a thumb.
 * Selected state is a neutral inversion, never the accent.
 */
export function RadioGroup<T extends string>({
  name,
  legend,
  options,
  value,
  defaultValue,
  onValueChange,
  className,
}: RadioGroupProps<T>) {
  const groupId = useId();

  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="mb-2 text-ui font-semibold text-muted">{legend}</legend>
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const optionId = `${groupId}-${option.value}`;
          const hintId = option.hint ? `${optionId}-hint` : undefined;
          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={cn(
                "group flex min-h-touch cursor-pointer items-start gap-3 rounded-button border border-line bg-surface px-3 py-2.5",
                "transition-colors duration-micro ease-out hover:bg-surface-2",
                "has-[:checked]:border-selected has-[:checked]:bg-selected has-[:checked]:text-selected-ink",
                "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                option.disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                id={optionId}
                type="radio"
                name={name}
                value={option.value}
                disabled={option.disabled}
                aria-describedby={hintId}
                {...(value !== undefined
                  ? { checked: value === option.value }
                  : { defaultChecked: defaultValue === option.value })}
                onChange={() => onValueChange?.(option.value)}
                className={cn(
                  "peer mt-0.5 h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-pill border-2 border-line bg-surface",
                  "checked:border-[6px] checked:border-selected-ink checked:bg-selected",
                  "group-has-[:checked]:border-selected-ink",
                )}
              />
              <span className="flex flex-col">
                <span className="text-body">{option.label}</span>
                {option.hint ? (
                  <span
                    id={hintId}
                    className="text-ui text-muted group-has-[:checked]:text-selected-ink group-has-[:checked]:opacity-80"
                  >
                    {option.hint}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
