import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { formatMoneyParts } from "@/lib/format";

const price = cva("num inline-flex items-baseline gap-1 font-mono text-ink", {
  variants: {
    size: {
      sm: "text-ui font-medium",
      md: "text-lead font-semibold",
      lg: "text-h2 font-semibold",
    },
  },
  defaultVariants: { size: "md" },
});

export type PriceProps = VariantProps<typeof price> & {
  /** Integer grosze straight from the database. Never a float, never from the client. */
  gr: number;
  /** e.g. "za mecz", "za dobę" — the unit the amount is charged in. */
  per?: string;
  className?: string;
};

/**
 * Mono + tabular figures so a column of prices lines up on the decimal.
 * The currency is set apart, but stays part of the same accessible string.
 */
export function Price({ gr, per, size, className }: PriceProps) {
  const { amount, currency } = formatMoneyParts(gr);

  return (
    <span className={cn(price({ size }), className)}>
      <span>{amount}</span>
      <span className="font-body font-normal text-muted">{currency}</span>
      {per ? (
        <span className="font-body text-ui font-normal text-muted">{per}</span>
      ) : null}
    </span>
  );
}
