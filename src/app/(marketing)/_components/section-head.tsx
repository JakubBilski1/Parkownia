import { cn } from "@/lib/cn";

/**
 * Every section opens the same way: a hairline, a small caps label, then the
 * heading. The rule is not ornament — it is the section boundary made visible,
 * which is what stops a long page of stacked <h2>s from reading as a document
 * dump. Deliberately NOT numbered (01 / 02 / 03): these sections are not a
 * sequence, and numbering things that are not ordered is on the anti-slop list.
 *
 * The label is body semibold, not mono: mono is reserved for money and codes
 * (DESIGN_SYSTEM §2) and spending it on decoration would blunt the one place it
 * has to mean something.
 */
export function SectionHead({
  label,
  title,
  lead,
  className,
}: {
  label: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("max-w-3xl", className)}>
      <p className="flex items-center gap-3 text-ui font-semibold uppercase tracking-[0.12em] text-muted">
        <span aria-hidden="true" className="h-px w-6 bg-line" />
        {label}
      </p>
      {/* Marketing display size. The app's six-level scale tops out at 36px and
          stays intact — a clamp is a responsive instance of h1, not a 7th level. */}
      <h2 className="mt-4 font-display text-[clamp(1.75rem,4.2vw,2.5rem)] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink">
        {title}
      </h2>
      {lead ? <p className="mt-4 max-w-2xl text-lead text-muted">{lead}</p> : null}
    </header>
  );
}
