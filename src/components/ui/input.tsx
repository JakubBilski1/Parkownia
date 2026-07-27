import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export const inputBase = [
  "w-full min-h-touch rounded-button border border-line bg-surface px-3 py-2",
  "font-body text-body text-ink placeholder:text-muted",
  "transition-[border-color,box-shadow,background-color] duration-micro ease-out",
  // Hover is a pointer-only affordance; on touch it fires as a tap and reads as
  // a glitch (same reason the map rail uses hover-hover:).
  "hover-hover:hover:border-muted",
  // The ring is drawn inside the field's own shape — see .field-focus.
  "field-focus",
  "disabled:cursor-not-allowed disabled:opacity-60",
  "aria-[invalid=true]:border-danger",
].join(" ");

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Right-hand adornment: unit, suffix ("zł", "cm"), never a decorative icon. */
  suffix?: React.ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = "text", suffix, ...props },
  ref,
) {
  const numeric = type === "number" || props.inputMode === "numeric" || props.inputMode === "decimal";

  const field = (
    <input
      ref={ref}
      type={type}
      className={cn(inputBase, numeric && "num", suffix && "pr-12", className)}
      {...props}
    />
  );

  if (!suffix) return field;

  return (
    <div className="relative">
      {field}
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ui text-muted">
        {suffix}
      </span>
    </div>
  );
});
