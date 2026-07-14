import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * A filter that is a link, not a button: the admin's filtered view has to survive
 * a refresh and be pasteable into a colleague's chat. The on state is a neutral
 * inversion — the accent belongs to the buttons that move money.
 */
export function FilterLink({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex min-h-touch shrink-0 items-center gap-1.5 rounded-pill border px-3 py-2 text-ui font-semibold",
        "transition-colors duration-micro ease-out",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        active
          ? "border-selected bg-selected text-selected-ink"
          : "border-line bg-surface text-ink hover:bg-surface-2",
      )}
    >
      <span>{children}</span>
      {typeof count === "number" ? (
        <span className={cn("num", active ? "opacity-80" : "text-muted")}>{count}</span>
      ) : null}
    </Link>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-h2 font-extrabold text-ink">{title}</h1>
        <p className="max-w-prose text-body text-muted">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function Section({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-0.5">
        <h2 className="font-display text-h3 font-bold text-ink">{title}</h2>
        {hint ? <p className="text-ui text-muted">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * A metric with its definition printed underneath. The definition is the point:
 * "GMV" means nothing until it says which rows it counted and by which date.
 */
export function Metric({
  label,
  value,
  definition,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  definition: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center gap-1.5 text-ui font-semibold text-muted">
        {Icon ? <Icon size={16} aria-hidden="true" /> : null}
        <span>{label}</span>
      </div>
      <div className="num font-display text-h2 font-bold text-ink">{value}</div>
      <p className="text-ui text-muted">{definition}</p>
    </div>
  );
}

/** Wide tables scroll inside their own box; the page body never scrolls sideways. */
export function TableScroll({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
      <table className="w-full min-w-[46rem] border-collapse text-left">{children}</table>
    </div>
  );
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-line px-4 py-3 text-ui font-semibold text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("border-b border-line px-4 py-3 align-middle text-ui", className)} {...props} />
  );
}
