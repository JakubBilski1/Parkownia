/**
 * Shared vocabulary of the scanner. Everything in this file is isomorphic: the
 * gate device evaluates a code against an offline manifest with exactly the
 * same types the server uses online, so an offline verdict and an online
 * verdict can never disagree in shape or wording.
 */

/** Mirrors the `scan_result` enum in the database. */
export type ScanResult = "ADMITTED" | "REJECTED_USED" | "REJECTED_INVALID" | "REJECTED_TIME";

/** Why the gate said what it said. The UI never shows a bare result. */
export type ScanReason =
  | "OK"
  | "CODE_UNKNOWN"
  | "WRONG_PARKING"
  | "NOT_PAID"
  | "CANCELLED"
  | "EXPIRED"
  | "ALREADY_USED"
  | "TOO_EARLY"
  | "TOO_LATE";

export type ScanSource = "CAMERA" | "MANUAL";

export type ScanBookingSummary = {
  spots: number;
  vehiclePlate: string | null;
  startsAt: string;
  endsAt: string;
  parkingId: string;
};

export type ScanVerdict = {
  result: ScanResult;
  reason: ScanReason;
  /** True when the verdict was decided on the device, against the manifest. */
  offline: boolean;
  booking?: ScanBookingSummary;
  /** Set on REJECTED_USED — when the code was first admitted. */
  firstScanAt?: string;
};

/**
 * One bookable code in the offline package. The raw code never leaves the
 * server: a stolen phone must not be a ticket printer.
 */
export type ManifestEntry = {
  codeHash: string;
  parkingId: string;
  startsAt: string;
  endsAt: string;
  spots: number;
  status: "CONFIRMED" | "USED";
};

export type ManifestParking = {
  id: string;
  title: string;
};

export type ScanManifest = {
  eventId: string;
  eventTitle: string;
  eventStartsAt: string;
  eventEndsAt: string;
  generatedAt: string;
  parkings: ManifestParking[];
  entries: ManifestEntry[];
};

/** A scan waiting in IndexedDB for the network to come back. */
export type QueuedScan = {
  id?: number;
  eventId: string;
  parkingId: string;
  codeHash: string;
  /** ISO 8601, from the device clock at the gate. */
  scannedAt: string;
  result: ScanResult;
  reason: ScanReason;
  source: ScanSource;
  deviceId: string;
};

export type SyncScanInput = {
  codeHash: string;
  scannedAt: string;
  result: ScanResult;
  deviceId: string;
};

/**
 * - APPLIED — recorded; an ADMITTED scan also marked the booking USED.
 * - DUPLICATE_IGNORED — same (booking, device, scannedAt) already stored; replaying a batch is free.
 * - CONFLICT_LOST — another device admitted this code earlier. First scan by `scanned_at` wins.
 * - ADMITTED_INVALID — the host let a car in on a code the server considers unpayable
 *   (cancelled, expired, unpaid). Recorded with conflict=true; the booking is not touched.
 * - UNKNOWN_CODE — no such code on any parking of this host.
 */
export type SyncOutcome =
  | "APPLIED"
  | "DUPLICATE_IGNORED"
  | "CONFLICT_LOST"
  | "ADMITTED_INVALID"
  | "UNKNOWN_CODE";

export type SyncResolution = {
  codeHash: string;
  scannedAt: string;
  deviceId: string;
  outcome: SyncOutcome;
  conflict: boolean;
};

/**
 * A driver who arrives 40 minutes early is still our driver, and a match runs
 * long. The gate accepts a code one hour either side of the booked window.
 */
export const SCAN_WINDOW_BUFFER_MS = 60 * 60 * 1000;

/** A manifest older than this is stale: bookings sold since then are missing from it. */
export const MANIFEST_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/** Guard rail for POST /api/scan/sync — one gate does not produce more in a night. */
export const SYNC_BATCH_LIMIT = 500;
