import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { bookingScans, bookings, parkings } from "@/db/schema";
import type { SyncResolution, SyncScanInput } from "./types";

/**
 * Drains the gate device's offline queue.
 *
 * Two guarantees the client depends on:
 *
 * 1. **Idempotence.** The key is (booking, device, scannedAt) — the unique index
 *    `booking_scans_idempotency_key`. A batch that times out after the server
 *    committed can be replayed verbatim; the second run changes nothing and
 *    returns the same resolutions.
 *
 * 2. **First scan wins.** The same code presented at two gates (or two phones
 *    at one gate) admits exactly one car: the scan with the earliest
 *    `scanned_at`. Every later admission is stored with `conflict = true` so the
 *    host and admin can see it happened — we do not silently drop evidence that
 *    a car got in twice. Ties go to the row already in the database, which makes
 *    the outcome deterministic under replay.
 */
export async function syncOfflineScans(
  hostId: string,
  scans: SyncScanInput[],
): Promise<SyncResolution[]> {
  const resolutions: SyncResolution[] = [];

  // Oldest first: applying a batch in scan order means the winner is decided on
  // the first insert instead of by demoting rows we just wrote.
  const ordered = [...scans].sort((a, b) => Date.parse(a.scannedAt) - Date.parse(b.scannedAt));

  for (const scan of ordered) {
    resolutions.push(await applyScan(hostId, scan));
  }

  return resolutions;
}

async function applyScan(hostId: string, scan: SyncScanInput): Promise<SyncResolution> {
  const scannedAt = new Date(scan.scannedAt);
  const key = { codeHash: scan.codeHash, scannedAt: scan.scannedAt, deviceId: scan.deviceId };

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: bookings.id,
        status: bookings.status,
        ownerId: parkings.ownerId,
      })
      .from(bookings)
      .innerJoin(parkings, eq(parkings.id, bookings.parkingId))
      .where(eq(bookings.codeHash, scan.codeHash))
      .for("update", { of: bookings })
      .limit(1);

    if (!row || row.ownerId !== hostId) {
      return { ...key, outcome: "UNKNOWN_CODE", conflict: false } as const;
    }

    const [existing] = await tx
      .select({ conflict: bookingScans.conflict })
      .from(bookingScans)
      .where(
        and(
          eq(bookingScans.bookingId, row.id),
          eq(bookingScans.deviceId, scan.deviceId),
          eq(bookingScans.scannedAt, scannedAt),
        ),
      )
      .limit(1);

    if (existing) {
      return { ...key, outcome: "DUPLICATE_IGNORED", conflict: existing.conflict } as const;
    }

    const insertScan = async (conflict: boolean) => {
      await tx
        .insert(bookingScans)
        .values({
          bookingId: row.id,
          scannedBy: hostId,
          scannedAt,
          syncedAt: new Date(),
          result: scan.result,
          offline: true,
          deviceId: scan.deviceId,
          conflict,
        })
        .onConflictDoNothing();
    };

    // A rejection recorded offline changes no state — it is an audit trail of
    // what the host saw at the barrier.
    if (scan.result !== "ADMITTED") {
      await insertScan(false);
      return { ...key, outcome: "APPLIED", conflict: false } as const;
    }

    // The host admitted a car on a code the server never considered valid
    // (cancelled after the manifest was pulled, or never paid). The car is
    // already parked; flag it rather than pretend it did not happen.
    if (row.status !== "CONFIRMED" && row.status !== "USED") {
      await insertScan(true);
      return { ...key, outcome: "ADMITTED_INVALID", conflict: true } as const;
    }

    const earlier = await tx
      .select({ id: bookingScans.id })
      .from(bookingScans)
      .where(
        and(
          eq(bookingScans.bookingId, row.id),
          eq(bookingScans.result, "ADMITTED"),
          eq(bookingScans.conflict, false),
          lte(bookingScans.scannedAt, scannedAt),
        ),
      )
      .limit(1);

    if (earlier.length > 0) {
      await insertScan(true);
      return { ...key, outcome: "CONFLICT_LOST", conflict: true } as const;
    }

    const later = await tx
      .select({ id: bookingScans.id })
      .from(bookingScans)
      .where(and(eq(bookingScans.bookingId, row.id), eq(bookingScans.result, "ADMITTED")));

    if (later.length > 0) {
      await tx
        .update(bookingScans)
        .set({ conflict: true, updatedAt: new Date() })
        .where(
          inArray(
            bookingScans.id,
            later.map((scanRow) => scanRow.id),
          ),
        );
    }

    await insertScan(false);

    if (row.status !== "USED") {
      await tx
        .update(bookings)
        .set({ status: "USED", updatedAt: new Date() })
        .where(eq(bookings.id, row.id));
    }

    return { ...key, outcome: "APPLIED", conflict: false } as const;
  });
}
