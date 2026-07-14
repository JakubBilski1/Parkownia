import type { Pkd } from "@/db/types";

/**
 * GUS REGON (BIR1) — optional enrichment only. It is a SOAP service that first
 * demands a session, is slow, and goes down. Every failure path here returns
 * null: a company must be able to register when GUS is asleep (docs/RISKS.md R12).
 *
 * We do not fetch the full PKD list — that needs a second, heavier report call
 * per subject. Legal form and REGON are what the payout/invoice flow will need;
 * the `pkd` column stays open for when it does.
 */

const BASE_URL = "https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc";
const TIMEOUT_MS = 3000;

export type GusCompany = {
  regon: string | null;
  legalForm: string | null;
  pkd: Pkd[] | null;
};

async function soap(action: string, body: string, sessionId?: string): Promise<string | null> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/soap+xml; charset=utf-8",
      // The action must travel in the content type for this endpoint.
      SOAPAction: `http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/${action}`,
    };
    if (sessionId) headers.sid = sessionId;

    const response = await fetch(BASE_URL, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function envelope(action: string, inner: string): string {
  return `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="http://CIS/BIR/PUBL/2014/07">
  <soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
    <wsa:To>${BASE_URL}</wsa:To>
    <wsa:Action>http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/${action}</wsa:Action>
  </soap:Header>
  <soap:Body>${inner}</soap:Body>
</soap:Envelope>`;
}

function extract(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i").exec(xml);
  const value = match?.[1]?.trim();
  return value ? value : null;
}

/** BIR1 returns its payload as an escaped XML document inside the SOAP result. */
function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

const LEGAL_FORM_LABEL: Record<string, string> = {
  P: "Osoba prawna",
  F: "Osoba fizyczna prowadząca działalność gospodarczą",
  LP: "Jednostka lokalna osoby prawnej",
  LF: "Jednostka lokalna osoby fizycznej",
};

/** Never throws, never blocks: returns null the moment anything is off. */
export async function lookupGus(nip: string): Promise<GusCompany | null> {
  const apiKey = process.env.GUS_API_KEY;
  if (!apiKey) return null;

  const loginXml = await soap(
    "Zaloguj",
    envelope("Zaloguj", `<ns:Zaloguj><ns:pKluczUzytkownika>${apiKey}</ns:pKluczUzytkownika></ns:Zaloguj>`),
  );
  const sessionId = loginXml ? extract(loginXml, "ZalogujResult") : null;
  if (!sessionId) return null;

  const searchXml = await soap(
    "DaneSzukajPodmioty",
    envelope(
      "DaneSzukajPodmioty",
      `<ns:DaneSzukajPodmioty><ns:pParametryWyszukiwania><dat:Nip xmlns:dat="http://CIS/BIR/PUBL/2014/07/DataContract">${nip}</dat:Nip></ns:pParametryWyszukiwania></ns:DaneSzukajPodmioty>`,
    ),
    sessionId,
  );

  // Fire-and-forget: holding the connection open to log out would cost the user
  // time for nothing.
  void soap("Wyloguj", envelope("Wyloguj", `<ns:Wyloguj><ns:pIdentyfikatorSesji>${sessionId}</ns:pIdentyfikatorSesji></ns:Wyloguj>`), sessionId);

  if (!searchXml) return null;

  const result = extract(searchXml, "DaneSzukajPodmiotyResult");
  if (!result) return null;

  const data = unescapeXml(result);
  const regon = extract(data, "Regon");
  const typ = extract(data, "Typ");
  const legalForm = typ ? (LEGAL_FORM_LABEL[typ] ?? null) : null;

  if (!regon && !legalForm) return null;

  return { regon, legalForm, pkd: null };
}
