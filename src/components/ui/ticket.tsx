import { cn } from "@/lib/cn";

/**
 * The booking is a ticket, not a card: two halves torn along a perforation, with
 * real holes punched at the tear (CSS mask — see .ticket-notch-* in globals.css).
 * The shadow is dropped from the halves and re-applied by a wrapper, otherwise
 * the mask would clip it and the holes would look painted on.
 */
export function Ticket({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative isolate flex flex-col rounded-card drop-shadow-ticket",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Upper half: what was bought, where, when. */
export function TicketMain({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "ticket-notch-bottom rounded-t-card bg-surface p-4 pb-5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Lower half: the stub the host tears off — code and QR. Carries the tear line
 * itself (an SVG dashed rule, not a CSS dashed border) so it always sits exactly
 * between the two punched holes.
 */
export function TicketStub({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "ticket-notch-top relative rounded-b-card bg-surface p-4 pt-5",
        className,
      )}
      {...props}
    >
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute left-4 right-4 top-0 h-px w-[calc(100%-2rem)] text-line"
        preserveAspectRatio="none"
        viewBox="0 0 100 1"
      >
        <line
          x1="0"
          y1="0.5"
          x2="100"
          y2="0.5"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {children}
    </div>
  );
}

export type TicketCodeProps = {
  code: string;
  label?: string;
  className?: string;
};

/** The one thing that gets read aloud at a barrier. Mono, large, selectable. */
export function TicketCode({
  code,
  label = "Twój kod",
  className,
}: TicketCodeProps) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-ui text-muted">{label}</span>
      <span className="num select-all font-mono text-h2 font-semibold tracking-[0.06em] text-ink">
        {code}
      </span>
    </div>
  );
}
