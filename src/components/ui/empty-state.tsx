import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type EmptyStateProps = {
  /** What is missing — stated plainly, never "Brak wyników". */
  title: string;
  /** Why it matters to the person reading it, and what they get if they act. */
  description: string;
  /** The invitation. Every empty screen is a chance to win supply. */
  action?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  icon: Icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-card border border-line bg-surface p-5",
        className,
      )}
    >
      {Icon ? <Icon size={22} aria-hidden="true" className="text-muted" /> : null}
      <h3 className="font-display text-h3 font-bold text-ink">{title}</h3>
      <p className="max-w-prose text-body text-muted">{description}</p>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
