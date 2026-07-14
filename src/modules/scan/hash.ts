/**
 * Isomorphic hashing: Web Crypto exists both in the browser (secure context —
 * the scanner is HTTPS or localhost anyway, the camera demands it) and in Node
 * 21. The gate device hashes the scanned code locally and compares hashes, so
 * a raw booking code is never persisted on the phone.
 */

/**
 * A QR payload may be the bare code or a deep link that ends with it
 * ("https://parkspot.pl/b/PK-7H2K-9QW3"). Everything after the last slash,
 * uppercased, whitespace removed.
 */
export function normalizeBookingCode(raw: string): string {
  const trimmed = raw.trim();
  const withoutQuery = trimmed.split(/[?#]/)[0] ?? trimmed;
  const lastSegment = withoutQuery.split("/").filter(Boolean).pop() ?? withoutQuery;
  return lastSegment.replace(/\s+/g, "").toUpperCase();
}

/** Rejects obvious garbage before it costs a database round trip. */
export function looksLikeBookingCode(value: string): boolean {
  return /^[A-Z0-9-]{6,40}$/.test(value);
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashBookingCode(rawCode: string): Promise<string> {
  return sha256Hex(normalizeBookingCode(rawCode));
}
