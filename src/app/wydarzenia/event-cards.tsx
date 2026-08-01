import { ArrowRight, MapPin } from "lucide-react";
import { Card, CardBody } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  formatDatePL,
  formatDayOfMonthPL,
  formatEventCountdownPL,
  formatTimeRangePL,
} from "@/lib/format";
import type { EventSummary } from "@/modules/events/service";
import { LinkButton } from "@/modules/events/ui/link-button";
import {
  EVENT_CATEGORY_COLOUR,
  EVENT_CATEGORY_ICON,
  EVENT_CATEGORY_LABEL,
} from "./event-meta";

/**
 * What kind of event this is: icon, word, and now the category's own colour on
 * the icon.
 *
 * Colour must never be the only carrier (DESIGN_PRINCIPLES §4) — 8% of men
 * cannot separate these greens and browns, and a football crowd is exactly that
 * audience — so the word stays and does the work on its own. The icon is the
 * same one the event's own page uses, so the list and the detail agree.
 */
function CategoryTag({ category }: { category: EventSummary["category"] }) {
  const Icon = EVENT_CATEGORY_ICON[category];
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-ui uppercase tracking-[0.14em] text-muted">
      <Icon
        size={14}
        aria-hidden="true"
        className="shrink-0"
        style={{ color: EVENT_CATEGORY_COLOUR[category] }}
      />
      {EVENT_CATEGORY_LABEL[category]}
    </span>
  );
}

/**
 * The category's colour: washed softly in from the corner, and a band down the
 * edge — the same treatment the clubs' colours used to get, now carrying
 * something every card actually has.
 *
 * It replaced a two-tone scarf built from the two clubs in a fixture title. That
 * painted football and nothing else: a fair, a concert and a marathon were
 * indistinguishable, which is backwards for a grid whose whole job is to let a
 * driver pick between kinds of evening. The band is one colour now because it
 * encodes one fact — there is no pairing to show.
 *
 * The band sits under the card's own padding rather than pushing it, so every
 * card still aligns in its row.
 */
function CategoryColour({ category }: { category: EventSummary["category"] }) {
  const colour = EVENT_CATEGORY_COLOUR[category];
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          background: `radial-gradient(120% 90% at 100% 100%, ${colour} 0%, transparent 62%)`,
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-[5px]"
        style={{ background: colour }}
      />
    </>
  );
}

/**
 * The day of the month, set huge and nearly transparent behind the card's text.
 * The date is the axis people choose an event along, so it earns the weight —
 * and it takes it from scale, not from a second brand colour (DESIGN_PRINCIPLES
 * §4 keeps the accent for the CTA alone).
 *
 * Decorative: the same date is spelled out in words below, so the numeral stays
 * out of the accessibility tree instead of being announced as a bare number.
 *
 * It is a direct child of the Card (the positioning context) and every Card here
 * pairs it with a `relative` CardBody. That ordering is load-bearing: an absolute
 * element paints above static siblings, so a plain CardBody would have the veil
 * laid over its own text.
 *
 * Callers must pass the size as the `text-[…]/none` shorthand, never as a bare
 * `text-[…]` plus a separate `leading-none` here: tailwind-merge treats a font
 * size as conflicting with `leading-*` (Tailwind's own text-* utilities set both),
 * so a size arriving later via className silently deletes the leading. That is
 * not hypothetical — it shipped, line-height fell back to the 1.5rem inherited
 * from <body>, and a 120px numeral was drawn into a 24px box and clipped to
 * illegible stumps by the card's overflow-hidden.
 *
 * The digits are generated content, not a text node. WCAG 1.4.3 exempts pure
 * decoration from contrast, and at 7% this is exactly that — but a contrast
 * checker cannot tell decoration from copy, so a DOM text node here scores 1.14:1
 * and lands in every automated report forever. Rendering it through ::before says
 * "decoration" in a way tooling understands, and keeps the audit at a true zero
 * instead of a zero with an asterisk nobody remembers.
 */
function GhostDay({ date, className }: { date: Date; className: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ "--ghost-day": `"${formatDayOfMonthPL(date)}"` } as React.CSSProperties}
      className={cn(
        "num pointer-events-none absolute select-none font-display font-extrabold text-ink opacity-[0.07]",
        "before:content-[var(--ghost-day)]",
        className,
      )}
    />
  );
}

/**
 * The soonest event — the one a driver is most likely here for. It gets the room,
 * the countdown, and, as the page's single main CTA, the only accent on screen.
 * Everything below it stays quiet, which is what keeps the accent meaning "this
 * is where you pay" rather than "this is a link".
 */
export function NextEventHero({ event }: { event: EventSummary }) {
  return (
    <Card className="relative mb-4 overflow-hidden lg:mb-6">
      <CategoryColour category={event.category} />
      <GhostDay date={event.startsAt} className="right-3 top-1 text-[8rem]/none sm:text-[11rem]/none" />

      <CardBody className="relative flex flex-col gap-2 p-5 sm:p-6 lg:p-8">
        {/* "Najbliższe" was once the whole eyebrow: the title named the clubs, so
            the category read as noise. That holds for a fixture and fails for a
            fair — "DREMA" tells a driver nothing on its own. It is information
            here, so it stays. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-mono text-ui uppercase tracking-[0.14em] text-muted">
            Najbliższe
          </span>
          <span className="num rounded-pill border border-line bg-surface-2 px-2.5 py-0.5 font-mono text-ui text-ink">
            {formatEventCountdownPL(event.startsAt, event.endsAt)}
          </span>
          <CategoryTag category={event.category} />
        </div>

        <h2 className="max-w-2xl text-balance font-display text-h2 font-extrabold text-ink lg:text-h1">
          {event.title}
        </h2>

        <p className="num font-mono text-body text-ink">
          {formatDatePL(event.startsAt)} · {formatTimeRangePL(event.startsAt, event.endsAt)}
        </p>

        <p className="flex items-center gap-1.5 text-ui text-muted">
          <MapPin size={16} aria-hidden="true" className="shrink-0" />
          {event.venue.name}
        </p>

        <LinkButton href={`/wydarzenia/${event.slug}`} variant="accent" className="mt-3 self-start">
          Zobacz parkingi
          <ArrowRight size={18} aria-hidden="true" />
        </LinkButton>
      </CardBody>
    </Card>
  );
}

/** Every event after the first: the hero's language, turned down. */
export function EventCard({ event }: { event: EventSummary }) {
  return (
    <Card className="relative flex h-full w-full flex-col overflow-hidden">
      <CategoryColour category={event.category} />
      <GhostDay date={event.startsAt} className="right-2 top-1 text-[6.5rem]/none" />

      <CardBody className="relative flex flex-1 flex-col gap-1.5">
        <CategoryTag category={event.category} />

        {/* Reserve two lines from the grid up. "Lech Poznań – Piast Gliwice" fits
            one line and "…– Jagiellonia Białystok" needs two, so without a floor
            the rules and dates below sit at different heights across a row —
            which is exactly what reads as slapdash. Mobile is one column, so it
            keeps the tight measure. */}
        <h3 className="text-balance font-display text-h3 font-bold text-ink sm:min-h-[3.5rem]">
          {event.title}
        </h3>

        <hr className="my-2 border-t border-line" />

        <p className="num font-mono text-ui text-ink">
          {formatDatePL(event.startsAt)} · {formatTimeRangePL(event.startsAt, event.endsAt)}
        </p>

        <p className="flex items-center gap-1.5 text-ui text-muted">
          <MapPin size={16} aria-hidden="true" className="shrink-0" />
          {event.venue.name}
        </p>

        {/* Quiet at every breakpoint. The hero already carries the accent, and
            this is navigation, not the money CTA (DESIGN_PRINCIPLES §4). The old
            grid shipped two of these — an accent one for phones, a ghost one for
            desktop — which is gone: one accent per screen, and it is the hero's. */}
        <LinkButton
          href={`/wydarzenia/${event.slug}`}
          variant="ghost"
          size="sm"
          className="-ml-3 mt-auto self-start text-muted hover:text-ink"
        >
          Zobacz parkingi
          <ArrowRight size={16} aria-hidden="true" />
        </LinkButton>
      </CardBody>
    </Card>
  );
}
