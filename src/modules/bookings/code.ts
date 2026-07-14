import { createHash, randomBytes } from "node:crypto";

/**
 * Crockford-style alphabet: no O/0 and no I/1. The code is read aloud at a
 * barrier, in the rain, and retyped by hand when the camera fails — the pairs
 * that get misread are simply not in the set.
 *
 * 32 symbols × 8 positions = 2^40 codes. 256 is a multiple of 32, so masking a
 * random byte with 0x1f is unbiased — no rejection sampling needed.
 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const GROUP_LENGTH = 4;
const GROUPS = 2;
const BODY_LENGTH = GROUP_LENGTH * GROUPS;

export const CODE_PATTERN = /^PK-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/;

export function generateBookingCode(): string {
  const bytes = randomBytes(BODY_LENGTH);
  let body = "";
  for (let i = 0; i < BODY_LENGTH; i += 1) {
    body += ALPHABET[(bytes[i] as number) & 0x1f];
  }
  return `PK-${body.slice(0, GROUP_LENGTH)}-${body.slice(GROUP_LENGTH)}`;
}

/** sha256(code) — the hash, never the code, is what ships in offline manifests. */
export function hashBookingCode(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase(), "utf8").digest("hex");
}

export function isBookingCode(value: string): boolean {
  return CODE_PATTERN.test(value.trim().toUpperCase());
}

/** Accepts what a human typed ("pk 7h2k m4rt", "PK7H2KM4RT") and returns the canonical form. */
export function normalizeBookingCode(input: string): string | null {
  const stripped = input.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const body = stripped.startsWith("PK") ? stripped.slice(2) : stripped;
  if (body.length !== BODY_LENGTH) return null;

  const code = `PK-${body.slice(0, GROUP_LENGTH)}-${body.slice(GROUP_LENGTH)}`;
  return CODE_PATTERN.test(code) ? code : null;
}
