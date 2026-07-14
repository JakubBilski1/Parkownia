"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type ChipProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "type"
> & {
  /** Reflected as aria-pressed — a filter is a toggle, not a link. */
  selected?: boolean;
  icon?: LucideIcon;
  /** Count of matching results, if known. Nothing else goes in here. */
  count?: number;
};

/**
 * Map filter. The on state is a neutral ink/bg inversion, never the accent:
 * an accent that marks "filtr włączony" would compete with the CTA that takes money.
 */
export function Chip({
  className,
  selected = false,
  icon: Icon,
  count,
  children,
  ...props
}: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "press inline-flex min-h-touch shrink-0 items-center gap-1.5 rounded-pill border px-3 py-2 text-ui font-semibold",
        "transition-colors duration-micro ease-out",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        selected
          ? "border-selected bg-selected text-selected-ink"
          : "border-line bg-surface text-ink hover:bg-surface-2",
        className,
      )}
      {...props}
    >
      {Icon ? <Icon size={16} aria-hidden="true" /> : null}
      <span>{children}</span>
      {typeof count === "number" ? (
        <span className={cn("num", selected ? "opacity-80" : "text-muted")}>
          {count}
        </span>
      ) : null}
    </button>
  );
}
