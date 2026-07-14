/**
 * NIP checksum, computed locally. Two reasons: the user learns at the 10th digit
 * that a typo happened (prevention beats an error message), and a malformed NIP
 * never costs us a call to the Biała Lista API.
 */

const WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7] as const;

/** Strips the separators people actually type: "123-456-32-18", "PL1234563218". */
export function normalizeNip(input: string): string {
  return input.replace(/^[Pp][Ll]/, "").replace(/\D/g, "");
}

export function isValidNip(input: string): boolean {
  const nip = normalizeNip(input);
  if (!/^\d{10}$/.test(nip)) return false;

  // All-identical digits pass the checksum for 0000000000; they are never real.
  if (/^(\d)\1{9}$/.test(nip)) return false;

  let sum = 0;
  for (let i = 0; i < WEIGHTS.length; i += 1) {
    sum += Number(nip[i]) * WEIGHTS[i]!;
  }

  const checksum = sum % 11;
  // 10 can never match a single check digit — such a number simply does not exist.
  if (checksum === 10) return false;

  return checksum === Number(nip[9]);
}
