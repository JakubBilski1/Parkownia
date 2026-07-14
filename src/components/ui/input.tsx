import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export const inputBase = [
  "w-full min-h-touch rounded-button border border-line bg-surface px-3 py-2",
  "font-body text-body text-ink placeholder:text-muted",
  "transition-colors duration-micro ease-out",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
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
