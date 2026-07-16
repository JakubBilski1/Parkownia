import { cn } from "@/lib/cn";

/**
 * The desktop "amateur" look came from capping a page's *shell* with the same
 * number that caps its *reading measure*: on a wide monitor a content page then
 * reads as a phone strip floating in empty margins. This separates the two.
 *
 * It is deliberately NOT applied to every page. Widening only helps when the
 * content inside can spend the room — a grid of cards, a wide table. A single
 * long form, a magic-link screen, a 404, the scanner's viewfinder and the map
 * are all narrow (or full-bleed) *on purpose*, and wrapping them here would
 * stretch a one-column layout across a monitor and make them worse. If you are
 * reaching for this on such a page, the container is not the fix.
 *
 * Below `lg:` every option collapses to the same mobile column, so phones render
 * exactly as before.
 */
export type PageWidth = "prose" | "wide";

const WIDTHS: Record<PageWidth, string> = {
  // Reading text — account, legal, settings. Measure stays ~680px everywhere.
  prose: "mx-auto w-full max-w-[680px] px-4",
  // Card grids and detail-with-aside — fills the space, capped so an ultrawide
  // keeps calm gutters. Pair it with a grid; on one column it is the wrong tool.
  wide: "mx-auto w-full max-w-3xl px-4 lg:max-w-6xl lg:px-6 2xl:px-8",
};

export type PageContainerProps = React.HTMLAttributes<HTMLDivElement> & {
  width?: PageWidth;
};

export function PageContainer({ width = "wide", className, ...props }: PageContainerProps) {
  return <div className={cn(WIDTHS[width], className)} {...props} />;
}
