import { cn } from "@/lib/cn";

export type ProgressProps = {
  /** 0–100. Determinate only: an indeterminate bar tells the user nothing. */
  value: number;
  label: string;
  /** Shows "3 z 5" next to the label. */
  hint?: string;
  className?: string;
};

export function Progress({ value, label, hint, className }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-ui font-semibold text-ink">{label}</span>
        {hint ? <span className="num text-ui text-muted">{hint}</span> : null}
      </div>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-2 w-full overflow-hidden rounded-pill bg-surface-2"
      >
        <div
          className="h-full rounded-pill bg-ink transition-[width] duration-layout ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
