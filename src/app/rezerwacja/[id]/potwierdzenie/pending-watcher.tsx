"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const POLL_MS = 3000;
const GIVE_UP_AFTER_MS = 120_000;

/**
 * The booking is PENDING because the webhook has not landed yet. Nielsen #1: the
 * driver must see the system working, not a frozen screen. We re-render the
 * server component every three seconds until the status changes — and stop after
 * two minutes rather than hammering the box forever.
 */
export function PendingWatcher() {
  const router = useRouter();

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > GIVE_UP_AFTER_MS) {
        clearInterval(timer);
        return;
      }
      router.refresh();
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [router]);

  return null;
}
