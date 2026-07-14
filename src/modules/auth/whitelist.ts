import { serviceUnavailable } from "@/lib/api";
import { normalizeNip } from "./nip";

/**
 * Biała Lista podatników VAT (Ministry of Finance) — no API key, ~10 req/s.
 * https://wl-api.mf.gov.pl/api/search/nip/{nip}?date=YYYY-MM-DD
 *
 * This is the authoritative source for company name, address, VAT status and
 * the bank accounts reported to the tax office. We never let the front end
 * decide those values: it may *edit* the name and address (the registry is
 * sometimes stale), but `vatStatus` and `bankAccounts` are only ever written
 * from this response.
 *
 * When the registry is down, registration must not stop — the caller turns a
 * WHITELIST_UNAVAILABLE into a 503 and the form falls back to manual entry.
 */

const BASE_URL = "https://wl-api.mf.gov.pl";
const TIMEOUT_MS = 4000;

export type WhitelistCompany = {
  nip: string;
  companyName: string;
  address: string | null;
  vatStatus: string | null;
  bankAccounts: string[];
  regon: string | null;
  checkedAt: Date;
};

type WhitelistSubject = {
  name?: string;
  nip?: string;
  statusVat?: string;
  regon?: string;
  workingAddress?: string;
  residenceAddress?: string;
  accountNumbers?: string[];
};

type WhitelistResponse = {
  result?: {
    subject?: WhitelistSubject | null;
  };
};

/**
 * The registry is queried "as of" a date; we always ask about today in
 * Europe/Warsaw. The components are spelled out because `sv-SE` with only a
 * `timeZone` yields "2026-7-14" — the API rejects that with a 400, which would
 * read here as "no such taxpayer".
 */
const DATE_FORMAT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Warsaw",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function today(): string {
  return DATE_FORMAT.format(new Date());
}

/**
 * Returns null when the NIP is simply not in the registry (a real answer).
 * Throws a 503 AppError when the registry itself did not answer.
 */
export async function lookupWhitelist(rawNip: string): Promise<WhitelistCompany | null> {
  const nip = normalizeNip(rawNip);
  const url = `${BASE_URL}/api/search/nip/${nip}?date=${today()}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw serviceUnavailable(
      "WHITELIST_UNAVAILABLE",
      "Rejestr Ministerstwa Finansów nie odpowiada. Wpisz dane firmy ręcznie — zweryfikujemy je później.",
    );
  }

  // 400 with a WL-xxx code means "no such subject for this date", not an outage.
  if (response.status === 400 || response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw serviceUnavailable(
      "WHITELIST_UNAVAILABLE",
      "Rejestr Ministerstwa Finansów nie odpowiada. Wpisz dane firmy ręcznie — zweryfikujemy je później.",
    );
  }

  const body = (await response.json()) as WhitelistResponse;
  const subject = body.result?.subject;
  if (!subject?.name) return null;

  return {
    nip: subject.nip ?? nip,
    companyName: subject.name,
    address: subject.workingAddress ?? subject.residenceAddress ?? null,
    vatStatus: subject.statusVat ?? null,
    bankAccounts: subject.accountNumbers ?? [],
    regon: subject.regon ?? null,
    checkedAt: new Date(),
  };
}
