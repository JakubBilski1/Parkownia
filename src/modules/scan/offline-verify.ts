import {
  SCAN_WINDOW_BUFFER_MS,
  type ManifestEntry,
  type ScanManifest,
  type ScanVerdict,
} from "./types";

/**
 * The offline gate. Pure function, no I/O, no clock of its own — the caller
 * passes `now` and whatever the device already admitted locally.
 *
 * The rule order is identical to the server (src/modules/scan/validate.ts):
 * code known -> parking matches -> not used -> time window. Two paths that can
 * drift apart would eventually contradict each other at the barrier, and the
 * host would stop trusting the screen.
 */
export type OfflineVerifyInput = {
  manifest: ScanManifest;
  codeHash: string;
  /** The gate the host is standing at. A host can run several at one event. */
  parkingId: string;
  now: Date;
  /** ISO timestamp of an earlier ADMITTED scan of this code on THIS device, if any. */
  locallyAdmittedAt?: string | null;
};

export function verifyAgainstManifest({
  manifest,
  codeHash,
  parkingId,
  now,
  locallyAdmittedAt,
}: OfflineVerifyInput): ScanVerdict {
  const entry: ManifestEntry | undefined = manifest.entries.find(
    (candidate) => candidate.codeHash === codeHash,
  );

  if (!entry) {
    return { result: "REJECTED_INVALID", reason: "CODE_UNKNOWN", offline: true };
  }

  if (entry.parkingId !== parkingId) {
    return { result: "REJECTED_INVALID", reason: "WRONG_PARKING", offline: true };
  }

  const booking = {
    spots: entry.spots,
    vehiclePlate: null,
    startsAt: entry.startsAt,
    endsAt: entry.endsAt,
    parkingId: entry.parkingId,
  };

  if (entry.status === "USED") {
    return { result: "REJECTED_USED", reason: "ALREADY_USED", offline: true, booking };
  }

  if (locallyAdmittedAt) {
    return {
      result: "REJECTED_USED",
      reason: "ALREADY_USED",
      offline: true,
      booking,
      firstScanAt: locallyAdmittedAt,
    };
  }

  const nowMs = now.getTime();
  const startsMs = Date.parse(entry.startsAt);
  const endsMs = Date.parse(entry.endsAt);

  if (nowMs < startsMs - SCAN_WINDOW_BUFFER_MS) {
    return { result: "REJECTED_TIME", reason: "TOO_EARLY", offline: true, booking };
  }

  if (nowMs > endsMs + SCAN_WINDOW_BUFFER_MS) {
    return { result: "REJECTED_TIME", reason: "TOO_LATE", offline: true, booking };
  }

  return { result: "ADMITTED", reason: "OK", offline: true, booking };
}
