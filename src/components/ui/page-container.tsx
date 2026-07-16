import { cn } from "@/lib/cn";

/**
 * The desktop "amateur" look came from wrapping every page in a single
 * `max-w-3xl` (768px) column: on a wide monitor that reads as a phone strip
 * floating in empty margins. The fix is to separate two constraints that were
 * conflated into one number — the outer *shell* (fills the space, capped so an
 * ultrawide keeps calm gutters) and the inner *reading measure* (kept narrow for
 * legibility). Each page picks a width by content type; below `lg:` every option
 * collapses to the same mobile column, so phones render exactly as before.
 */
export type PageWidth = "prose" | "default" | "wide" | "full";

const WIDTHS: Record<PageWidth, string> = {
  // Legal / account reading text — measure stays ~680px at every breakpoint.
  prose: "mx-auto w-full max-w-[680px] px-4",
  // Single-column content pages — widen a step on desktop, never edge-to-edge.
  default: "mx-auto w-full max-w-3xl px-4 lg:max-w-5xl lg:px-6",
  // Grids, tables, detail-with-aside — the shell fills the space, capped ~1280px.
  wide: "mx-auto w-full max-w-3xl px-4 lg:max-w-6xl lg:px-6 2xl:px-8",
  // Split-view map screen only: the composition owns the whole viewport.
  full: "w-full",
};

export type PageContainerProps = React.HTMLAttributes<HTMLDivElement> & {
  width?: PageWidth;
};

export function PageContainer({
  width = "default",
  className,
  ...props
}: PageContainerProps) {
  return <div className={cn(WIDTHS[width], className)} {...props} />;
}
