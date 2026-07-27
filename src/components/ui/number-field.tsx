"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { inputBase } from "./input";

export type NumberFieldProps = {
  id?: string;
  name?: string;
  value: number;
  onValueChange: (next: number) => void;
  min?: number;
  max?: number;
  /** How much one −/+ press moves the value. Typing ignores it entirely. */
  step?: number;
  /** Unit typeset beside the number ("zł", "miejsc"). Never a decorative icon. */
  suffix?: React.ReactNode;
  /** −/+ buttons: two 44px targets beat a 12px spinner arrow under a thumb. */
  steppers?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
};

/**
 * A whole-number field that does not fight the person typing into it.
 *
 * `<input type="number">` bound straight to a number is the trap this replaces.
 * With a field showing 0, typing "15" left "015" on screen: the DOM held "015",
 * Number("015") is 15, the parent state went to 15 — and because the *rendered*
 * value prop had already been 15 on the keystroke before, React saw no change
 * and never rewrote the DOM. The stale zero just sat there. Same class of bug
 * empties the field to "0" the moment you select-all and delete, so you can
 * never clear it to type a fresh number.
 *
 * So: hold the text locally, keep digits only, never allow a leading zero, and
 * let the field be genuinely empty while the caret is in it. The parent only
 * ever hears about clamped whole numbers. type="text" + inputMode="numeric"
 * also drops the native spinners, which were the other thing that looked cheap.
 */
/**
 * Digits only, and never a leading zero. Exported so the rule that killed the
 * "015" bug is pinned by a test rather than by a comment — the regression is
 * invisible to type checks, lint and build, which all passed while it shipped.
 */
export function normalizeDigits(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

export function NumberField({
  id,
  name,
  value,
  onValueChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  suffix,
  steppers = false,
  className,
  ...aria
}: NumberFieldProps) {
  const [text, setText] = useState(() => String(value));
  // What the parent last heard from us. Lets us tell "the parent changed this"
  // apart from "we just told the parent", so typing is never clobbered.
  const committed = useRef(value);

  useEffect(() => {
    if (value === committed.current) return;
    committed.current = value;
    setText(String(value));
  }, [value]);

  function clamp(n: number): number {
    return Math.min(max, Math.max(min, Math.round(n)));
  }

  function commit(n: number) {
    committed.current = n;
    onValueChange(n);
  }

  function handleChange(raw: string) {
    const cleaned = normalizeDigits(raw);
    if (cleaned === "") {
      // Empty is a legitimate state mid-edit. onBlur puts a number back.
      setText("");
      return;
    }
    const clamped = clamp(Number(cleaned));
    setText(String(clamped));
    commit(clamped);
  }

  function handleBlur() {
    if (text === "") setText(String(committed.current));
  }

  function bump(delta: number) {
    const next = clamp((text === "" ? committed.current : Number(text)) + delta);
    setText(String(next));
    commit(next);
  }

  const field = (
    <input
      id={id}
      name={name}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      value={text}
      onChange={(event) => handleChange(event.target.value)}
      onBlur={handleBlur}
      {...aria}
      className={cn(
        "num min-h-touch bg-transparent text-body text-ink focus-visible:outline-none",
        steppers ? "w-16 border-0 px-0 text-center" : cn(inputBase, "w-24"),
      )}
    />
  );

  if (!steppers) {
    if (!suffix) return <div className={className}>{field}</div>;
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {field}
        <span className="text-body text-muted">{suffix}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-stretch rounded-button border border-line bg-surface",
        "transition-[border-color,box-shadow] duration-micro ease-out",
        "focus-within:border-focus focus-within:shadow-[0_0_0_3px_var(--focus-ring)]",
        className,
      )}
    >
      <StepButton
        onClick={() => bump(-step)}
        disabled={value <= min}
        label={`Zmniejsz o ${step}`}
      >
        <Minus size={18} aria-hidden="true" />
      </StepButton>

      <span className="flex items-center gap-1 border-x border-line px-2">
        {field}
        {suffix ? <span className="pr-1 text-ui text-muted">{suffix}</span> : null}
      </span>

      <StepButton
        onClick={() => bump(step)}
        disabled={value >= max}
        label={`Zwiększ o ${step}`}
      >
        <Plus size={18} aria-hidden="true" />
      </StepButton>
    </div>
  );
}

function StepButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "inline-flex min-h-touch w-touch items-center justify-center rounded-button text-muted",
        "transition-colors duration-micro ease-out",
        "hover-hover:hover:bg-surface-2 hover-hover:hover:text-ink",
        "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
        "disabled:pointer-events-none disabled:opacity-40",
      )}
    >
      {children}
    </button>
  );
}
