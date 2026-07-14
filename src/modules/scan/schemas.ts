import { z } from "zod";
import { SYNC_BATCH_LIMIT } from "./types";

const isoDateTime = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Nieprawidłowy znacznik czasu");

const codeHash = z.string().regex(/^[0-9a-f]{64}$/, "Nieprawidłowy skrót kodu");

const bookingCode = z.string().min(4).max(64);

const uuid = z.string().uuid();

/** Either the raw code (camera or keyboard) or its hash — never both required. */
export const validateScanSchema = z
  .object({
    code: bookingCode.optional(),
    codeHash: codeHash.optional(),
    parkingId: uuid,
    deviceId: z.string().min(1).max(64).optional(),
  })
  .refine((value) => Boolean(value.code) || Boolean(value.codeHash), {
    message: "Podaj kod rezerwacji",
    path: ["code"],
  });

/** Manual entry always carries the typed code: the server, not the phone, hashes it. */
export const manualScanSchema = z.object({
  code: bookingCode,
  parkingId: uuid,
  deviceId: z.string().min(1).max(64).optional(),
});

export const manifestQuerySchema = z.object({
  eventId: uuid,
});

export const syncScanSchema = z.object({
  codeHash,
  scannedAt: isoDateTime,
  result: z.enum(["ADMITTED", "REJECTED_USED", "REJECTED_INVALID", "REJECTED_TIME"]),
  deviceId: z.string().min(1).max(64),
});

export const syncBatchSchema = z.object({
  scans: z.array(syncScanSchema).min(1).max(SYNC_BATCH_LIMIT),
});

export type ValidateScanInput = z.infer<typeof validateScanSchema>;
export type ManualScanInput = z.infer<typeof manualScanSchema>;
export type SyncBatchInput = z.infer<typeof syncBatchSchema>;
