import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookingScans, bookings, parkings } from "@/db/schema";
import { hashBookingCode } from "./hash";
import { SCAN_WINDOW_BUFFER_MS, type ScanVerdict } from "./types";

export type ValidateScanArgs = {
  hostId: string;
  parkingId: string;
  /** Raw code (typed or decoded from the QR). Hashed here, never stored raw. */
  code?: string;
  /** Or the hash straight from the device, which never held the raw code. */
  codeHash?: string;
  deviceId?: string;
  now?: Date;
};

/**
 * Online gate. Runs in one transaction with `SELECT ... FOR UPDATE` on the
 * booking row: two phones scanning the same code in the same second must not
 * both admit a car. The rule order matches the offline path exactly
 * (src/modules/scan/offline-verify.ts).
 */
export async function validateScan(args: ValidateScanArgs): Promise<ScanVerdict> {
  const { hostId, parkingId, deviceId } = args;
  const now = args.now ?? new Date();

  const hash = args.codeHash ?? (args.code ? await hashBookingCode(args.code) : null);
  if (!hash) {
    return { result: "REJECTED_INVALID", reason: "CODE_UNKNOWN", offline: false };
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: bookings.id,
        parkingId: bookings.parkingId,
        status: bookings.status,
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
        spots: bookings.spots,
        vehiclePlate: bookings.vehiclePlate,
        ownerId: parkings.ownerId,
      })
      .from(bookings)
      .innerJoin(parkings, eq(parkings.id, bookings.parkingId))
      .where(eq(bookings.codeHash, hash))
      .for("update", { of: bookings })
      .limit(1);

    // A code belonging to somebody else's parking is reported as unknown, not as
    // "wrong parking": the gate must not become an oracle for other hosts' sales.
    if (!row || row.ownerId !== hostId) {
      return { result: "REJECTED_INVALID", reason: "CODE_UNKNOWN", offline: false } as const;
    }

    const booking = {
      spots: row.spots,
      vehiclePlate: row.vehiclePlate,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      parkingId: row.parkingId,
    };

    const record = async (verdict: ScanVerdict): Promise<ScanVerdict> => {
      await tx
        .insert(bookingScans)
        .values({
          bookingId: row.id,
          scannedBy: hostId,
          scannedAt: now,
          syncedAt: now,
          result: verdict.result,
          offline: false,
          deviceId: deviceId ?? null,
          conflict: false,
        })
        .onConflictDoNothing();
      return verdict;
    };

    if (row.parkingId !== parkingId) {
      return record({
        result: "REJECTED_INVALID",
        reason: "WRONG_PARKING",
        offline: false,
        booking,
      });
    }

    if (row.status === "USED") {
      const [firstScan] = await tx
        .select({ scannedAt: bookingScans.scannedAt })
        .from(bookingScans)
        .where(and(eq(bookingScans.bookingId, row.id), eq(bookingScans.result, "ADMITTED")))
        .orderBy(bookingScans.scannedAt)
        .limit(1);

      return record({
        result: "REJECTED_USED",
        reason: "ALREADY_USED",
        offline: false,
        booking,
        ...(firstScan ? { firstScanAt: firstScan.scannedAt.toISOString() } : {}),
      });
    }

    if (row.status === "PENDING") {
      return record({ result: "REJECTED_INVALID", reason: "NOT_PAID", offline: false, booking });
    }

    if (row.status === "CANCELLED") {
      return record({ result: "REJECTED_INVALID", reason: "CANCELLED", offline: false, booking });
    }

    if (row.status === "EXPIRED") {
      return record({ result: "REJECTED_INVALID", reason: "EXPIRED", offline: false, booking });
    }

    // NO_SHOW is written after the window closed, so a code presented now is late.
    if (row.status === "NO_SHOW") {
      return record({ result: "REJECTED_TIME", reason: "TOO_LATE", offline: false, booking });
    }

    const nowMs = now.getTime();

    if (nowMs < row.startsAt.getTime() - SCAN_WINDOW_BUFFER_MS) {
      return record({ result: "REJECTED_TIME", reason: "TOO_EARLY", offline: false, booking });
    }

    if (nowMs > row.endsAt.getTime() + SCAN_WINDOW_BUFFER_MS) {
      return record({ result: "REJECTED_TIME", reason: "TOO_LATE", offline: false, booking });
    }

    await tx
      .update(bookings)
      .set({ status: "USED", updatedAt: now })
      .where(eq(bookings.id, row.id));

    return record({ result: "ADMITTED", reason: "OK", offline: false, booking });
  });
}
