"use client";

import { ChevronRight, Clock } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { formatTimeRangePL } from "@/lib/format";
import { ROUTES } from "@/components/nav/routes";
import { bookingsResponseSchema, type ActiveBooking } from "./types";

/**
 * The first thing a signed-in driver sees, above the map (DESIGN_PRINCIPLES 6.5):
 * nobody memorises their code, and at the barrier they must not have to hunt for
 * it. 401 means "not signed in" and renders nothing — no error, no noise.
 */
export function ActiveBookingBanner({ className }: { className?: string }) {
  const [booking, setBooking] = useState<ActiveBooking | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/bookings/mine", {
      signal: controller.signal,
      credentials: "include",
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) return;
        const parsed = bookingsResponseSchema.safeParse(await response.json());
        if (!parsed.success) return;
        const active = parsed.data.items.find(
          (item) => item.status === "CONFIRMED" || item.status === "PENDING",
        );
        setBooking(active ?? null);
      })
      .catch(() => {
        // A driver who is not signed in is not an error state.
      });

    return () => controller.abort();
  }, []);

  if (!booking) return null;

  const pending = booking.status === "PENDING";

  return (
    <Link
      href={ROUTES.booking(booking.id)}
      className={cn(
        "press flex items-center gap-3 rounded-card border border-line bg-surface p-3 shadow-float",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-ui text-muted">
          {pending ? "Rezerwacja czeka na płatność" : "Twoja rezerwacja"}
        </span>
        <span className="truncate text-body font-semibold text-ink">
          {booking.parking.title ?? "Parking"}
        </span>
        <span className="num flex items-center gap-1.5 text-ui text-muted">
          <Clock size={14} aria-hidden="true" />
          {formatTimeRangePL(booking.startsAt, booking.endsAt)}
        </span>
      </span>

      {booking.code && !pending ? (
        <span className="num shrink-0 rounded-chip border border-line bg-surface-2 px-2 py-1 font-mono text-ui font-semibold tracking-[0.06em] text-ink">
          {booking.code}
        </span>
      ) : (
        <span className="shrink-0 text-ui font-semibold text-ink">
          {pending ? "Zapłać" : "Pokaż kod"}
        </span>
      )}

      <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-muted" />
    </Link>
  );
}
