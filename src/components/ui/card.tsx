import { cn } from "@/lib/cn";

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Lifts the card off the map layer (parking sheet, floating panel). */
  floating?: boolean;
  /**
   * A card the whole of which is a target (an event, a parking): on a pointer
   * device it lifts a hair and deepens its shadow on hover. Gated behind
   * `hover-hover:` so touch never triggers it, and the enumerated transition
   * (never `transition-all`) is stilled by the global reduced-motion block.
   */
  interactive?: boolean;
};

export function Card({
  className,
  floating = false,
  interactive = false,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-line bg-surface",
        floating ? "shadow-float" : "shadow-card",
        interactive &&
          "transition-[box-shadow,transform] duration-micro ease-out hover-hover:hover:-translate-y-0.5 hover-hover:hover:shadow-card-hover",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-4 pb-0", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("font-display text-h3 font-bold text-ink", className)}
      {...props}
    />
  );
}

export function CardMeta({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-ui text-muted", className)} {...props} />;
}

export function CardBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center gap-2 border-t border-line p-4", className)}
      {...props}
    />
  );
}
