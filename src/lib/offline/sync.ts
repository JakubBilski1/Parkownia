"use client";

import { SYNC_BATCH_LIMIT, type SyncResolution, type SyncScanInput } from "@/modules/scan/types";
import { dropScans, pendingCount, pendingScans } from "./db";

/**
 * Client half of the offline queue. The server is the only place conflicts are
 * decided (src/modules/scan/sync.ts); this file only gets the rows there and
 * deletes them once the server has them.
 *
 * Rows are deleted ONLY on a 2xx. A failed or aborted request leaves the queue
 * intact — POST /api/scan/sync is idempotent on (booking, device, scannedAt),
 * so re-sending a batch the server already stored is free. Losing a scan is not.
 */

export type SyncReport = {
  sent: number;
  resolutions: SyncResolution[];
  /** Codes the host let in that the server refuses to honour, plus double admissions. */
  conflicts: SyncResolution[];
};

let running: Promise<SyncReport | null> | null = null;

export async function syncPending(): Promise<SyncReport | null> {
  running ??= run().finally(() => {
    running = null;
  });
  return running;
}

async function run(): Promise<SyncReport | null> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;

  const queued = await pendingScans(SYNC_BATCH_LIMIT);
  if (queued.length === 0) return { sent: 0, resolutions: [], conflicts: [] };

  const scans: SyncScanInput[] = queued.map((scan) => ({
    codeHash: scan.codeHash,
    scannedAt: scan.scannedAt,
    result: scan.result,
    deviceId: scan.deviceId,
  }));

  const response = await fetch("/api/scan/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scans }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`sync failed: ${response.status}`);
  }

  const payload = (await response.json()) as { resolutions: SyncResolution[] };
  const resolutions = payload.resolutions ?? [];

  const ids = queued
    .map((scan) => scan.id)
    .filter((id): id is number => typeof id === "number");
  await dropScans(ids);

  return {
    sent: queued.length,
    resolutions,
    conflicts: resolutions.filter(
      (resolution) => resolution.conflict || resolution.outcome === "UNKNOWN_CODE",
    ),
  };
}

export type AutoSyncCallbacks = {
  onReport?: (report: SyncReport) => void;
  onPendingChange?: (count: number) => void;
};

const BACKOFF_MS = [2_000, 5_000, 15_000, 30_000, 60_000];

/**
 * Retries until the queue is empty. The trigger is the `online` event plus a
 * backoff timer, because `navigator.onLine` lies: a phone can be attached to a
 * saturated cell at the stadium and report itself online while nothing gets
 * through. The timer is what actually drains the queue in that case.
 */
export function startAutoSync({ onReport, onPendingChange }: AutoSyncCallbacks = {}): () => void {
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const publishCount = async () => {
    if (!onPendingChange) return;
    try {
      onPendingChange(await pendingCount());
    } catch {
      // Reporting the counter must never break the scanner.
    }
  };

  const schedule = (delay: number) => {
    if (stopped || timer) return;
    timer = setTimeout(() => {
      timer = null;
      void attemptSync();
    }, delay);
  };

  const attemptSync = async () => {
    if (stopped) return;

    try {
      const report = await syncPending();
      if (report) {
        attempt = 0;
        if (report.sent > 0) onReport?.(report);
      }
    } catch {
      const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] ?? 60_000;
      attempt += 1;
      schedule(delay);
    }

    await publishCount();

    try {
      if ((await pendingCount()) > 0) {
        schedule(BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] ?? 60_000);
      }
    } catch {
      // ignore
    }
  };

  const onOnline = () => {
    attempt = 0;
    void attemptSync();
  };

  window.addEventListener("online", onOnline);
  void attemptSync();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    window.removeEventListener("online", onOnline);
  };
}
