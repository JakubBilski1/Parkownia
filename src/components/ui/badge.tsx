import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

const badge = cva(
  "inline-flex items-center gap-1.5 rounded-chip border px-2 py-1 text-ui font-semibold",
  {
    variants: {
      tone: {
        neutral: "border-line bg-surface-2 text-ink",
        ok: "border-scan-ok bg-surface text-scan-ok",
        bad: "border-danger bg-surface text-danger",
        muted: "border-line bg-surface text-muted",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badge> & {
    /**
     * Required, not optional: 8% of men cannot rely on colour, and football fans
     * are exactly that population. Status must be readable without hue.
     */
    icon: LucideIcon;
  };

export function Badge({
  className,
  tone,
  icon: Icon,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(badge({ tone }), className)} {...props}>
      <Icon size={14} aria-hidden="true" className="shrink-0" />
      <span>{children}</span>
    </span>
  );
}
