import { describe, expect, it } from "vitest";
import { hashBookingCode, looksLikeBookingCode, normalizeBookingCode } from "@/modules/scan/hash";
import { verifyAgainstManifest } from "@/modules/scan/offline-verify";
import { SCAN_WINDOW_BUFFER_MS, type ScanManifest } from "@/modules/scan/types";

const PARKING = "8b3a4b1e-0000-4000-8000-000000000001";
const OTHER_PARKING = "8b3a4b1e-0000-4000-8000-000000000002";

const START = new Date("2026-07-25T18:00:00Z");
const END = new Date("2026-07-25T23:00:00Z");

function manifest(entries: ScanManifest["entries"]): ScanManifest {
  return {
    eventId: "event-1",
    eventTitle: "Lech – Cracovia · Enea Stadion",
    eventStartsAt: START.toISOString(),
    eventEndsAt: END.toISOString(),
    generatedAt: "2026-07-25T09:00:00Z",
    parkings: [{ id: PARKING, title: "Górczyńska 12" }],
    entries,
  };
}

const entry = {
  codeHash: "a".repeat(64),
  parkingId: PARKING,
  startsAt: START.toISOString(),
  endsAt: END.toISOString(),
  spots: 1,
  status: "CONFIRMED" as const,
};

describe("normalizeBookingCode", () => {
  it("takes the code out of a deep link and uppercases it", () => {
    expect(normalizeBookingCode("https://parkownia.com/b/pk-7h2k-9qw3")).toBe("PK-7H2K-9QW3");
    expect(normalizeBookingCode("  pk-7h2k-9qw3 ")).toBe("PK-7H2K-9QW3");
    expect(normalizeBookingCode("https://parkownia.com/b/PK-7H2K?utm=sms")).toBe("PK-7H2K");
  });

  it("rejects garbage before it costs a round trip", () => {
    expect(looksLikeBookingCode("PK-7H2K-9QW3")).toBe(true);
    expect(looksLikeBookingCode("ABC")).toBe(false);
    expect(looksLikeBookingCode("HTTP://EVIL/<SCRIPT>")).toBe(false);
  });

  it("hashes the normalised code, not the raw scan", async () => {
    const fromLink = await hashBookingCode("https://parkownia.com/b/pk-7h2k-9qw3");
    const fromCode = await hashBookingCode("PK-7H2K-9QW3");
    expect(fromLink).toBe(fromCode);
    expect(fromCode).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("verifyAgainstManifest", () => {
  const inside = new Date("2026-07-25T19:00:00Z");

  it("admits a confirmed code inside the window", () => {
    const verdict = verifyAgainstManifest({
      manifest: manifest([entry]),
      codeHash: entry.codeHash,
      parkingId: PARKING,
      now: inside,
    });

    expect(verdict.result).toBe("ADMITTED");
    expect(verdict.offline).toBe(true);
    expect(verdict.booking?.spots).toBe(1);
  });

  it("does not know codes that are not in the package", () => {
    const verdict = verifyAgainstManifest({
      manifest: manifest([entry]),
      codeHash: "b".repeat(64),
      parkingId: PARKING,
      now: inside,
    });

    expect(verdict).toMatchObject({ result: "REJECTED_INVALID", reason: "CODE_UNKNOWN" });
  });

  it("refuses a code bought for another gate", () => {
    const verdict = verifyAgainstManifest({
      manifest: manifest([entry]),
      codeHash: entry.codeHash,
      parkingId: OTHER_PARKING,
      now: inside,
    });

    expect(verdict).toMatchObject({ result: "REJECTED_INVALID", reason: "WRONG_PARKING" });
  });

  it("refuses a code this device already admitted, and says when", () => {
    const verdict = verifyAgainstManifest({
      manifest: manifest([entry]),
      codeHash: entry.codeHash,
      parkingId: PARKING,
      now: inside,
      locallyAdmittedAt: "2026-07-25T18:42:00Z",
    });

    expect(verdict).toMatchObject({
      result: "REJECTED_USED",
      reason: "ALREADY_USED",
      firstScanAt: "2026-07-25T18:42:00Z",
    });
  });

  it("refuses a code already marked used in the package", () => {
    const verdict = verifyAgainstManifest({
      manifest: manifest([{ ...entry, status: "USED" }]),
      codeHash: entry.codeHash,
      parkingId: PARKING,
      now: inside,
    });

    expect(verdict).toMatchObject({ result: "REJECTED_USED", reason: "ALREADY_USED" });
  });

  it("holds the one-hour buffer on both ends", () => {
    const justInsideEarly = new Date(START.getTime() - SCAN_WINDOW_BUFFER_MS + 1000);
    const tooEarly = new Date(START.getTime() - SCAN_WINDOW_BUFFER_MS - 1000);
    const justInsideLate = new Date(END.getTime() + SCAN_WINDOW_BUFFER_MS - 1000);
    const tooLate = new Date(END.getTime() + SCAN_WINDOW_BUFFER_MS + 1000);

    const at = (now: Date) =>
      verifyAgainstManifest({
        manifest: manifest([entry]),
        codeHash: entry.codeHash,
        parkingId: PARKING,
        now,
      });

    expect(at(justInsideEarly).result).toBe("ADMITTED");
    expect(at(tooEarly)).toMatchObject({ result: "REJECTED_TIME", reason: "TOO_EARLY" });
    expect(at(justInsideLate).result).toBe("ADMITTED");
    expect(at(tooLate)).toMatchObject({ result: "REJECTED_TIME", reason: "TOO_LATE" });
  });
});
