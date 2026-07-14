import { cn } from "@/lib/cn";

/**
 * Lists load as skeletons, never spinners: the layout is reserved up front, so
 * nothing jumps when the parkings arrive (zero layout shift is a hard rule).
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-shimmer rounded-chip bg-surface-2",
        "bg-[linear-gradient(90deg,var(--surface-2)_25%,var(--line)_50%,var(--surface-2)_75%)] bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  );
}

/** Placeholder for one parking row in the list under the map. */
export function SkeletonParkingCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-card border border-line bg-surface p-4",
        className,
      )}
    >
      <Skeleton className="h-16 w-16 shrink-0 rounded-chip" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-4 w-1/4" />
      </div>
    </div>
  );
}

export function SkeletonList({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)} aria-busy="true">
      <span className="sr-only">Ładujemy parkingi.</span>
      {Array.from({ length: count }, (_, index) => (
        <SkeletonParkingCard key={index} />
      ))}
    </div>
  );
}
