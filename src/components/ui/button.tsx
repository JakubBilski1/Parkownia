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
    /** Adds a spinner beside the label and blocks re-submission. */
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
      {/*
       * The wrapper keeps the children together so the spinner sits beside the
       * whole label rather than between an icon and its word — but it has to lay
       * them out itself.
       *
       * It used to be a bare <span>. As the button's only flex item it was
       * blockified, which meant the button's own `items-center gap-2` applied to
       * nothing, and Tailwind's preflight (`svg { display: block }`) then put
       * every icon on its own line ABOVE its label. That is what "Wznów
       * sprzedaż" looked like, and "Pobierz moje dane", and the scanner's manual
       * entry, and every add/delete button in /admin/klienci — eleven of them,
       * all broken the same way by one line here.
       */}
      <span className="inline-flex items-center gap-2">{children}</span>
    </button>
  );
});

export { button as buttonVariants };
