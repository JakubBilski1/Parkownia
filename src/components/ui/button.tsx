import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

const button = cva(
  [
    "press inline-flex select-none items-center justify-center gap-2",
    "rounded-button font-body font-semibold",
    "transition-colors duration-micro ease-out",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        // The one sacred use of the accent: the primary action on a screen.
        accent: "bg-accent text-accent-ink hover:bg-accent-hover active:bg-accent-active",
        quiet: "border border-line bg-surface text-ink hover:bg-surface-2",
        ghost: "bg-transparent text-ink hover:bg-surface-2",
        // Outlined, not filled: in the light theme the stamp-red accent and the
        // danger red are two deep reds. A filled danger button would read as the
        // CTA — and "Anuluj rezerwację" must never look like "Zarezerwuj".
        danger: "border border-danger bg-surface text-danger hover:bg-danger-soft",
      },
      size: {
        sm: "min-h-touch px-3 text-ui",
        md: "min-h-touch px-4 text-body",
        lg: "min-h-[3.25rem] px-6 text-lead",
      },
      block: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: { variant: "quiet", size: "md", block: false },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button> & {
    /** Adds a spinner and blocks re-submission; the label stays put (no layout shift). */
    loading?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, loading = false, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={props.type ?? "button"}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(button({ variant, size, block }), className)}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-pill border-2 border-current border-t-transparent"
        />
      ) : null}
      <span>{children}</span>
    </button>
  );
});

export { button as buttonVariants };
