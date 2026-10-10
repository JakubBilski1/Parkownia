const STORAGE_KEY = "parkownia-z";

/** A short slug or nothing — the value comes from the URL, so it is untrusted. */
function clean(raw: string | null | undefined): string | null {
  const tag = raw?.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  return tag || null;
}

/**
 * Remembers which campaign link brought the visitor (`?z=mail`, or utm_source
 * from anything a tool generates), for the length of the tab session. Has to be
 * captured on arrival: the calculator rewrites the query string half a second
 * after load and does not carry unknown params over.
 */
export function rememberCampaign(raw: string | null): void {
  const tag = clean(raw);
  if (!tag) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, tag);
  } catch {
    // Storage blocked: the lead still goes through, just untagged.
  }
}

/**
 * The `source` a lead form sends: its own name, plus the campaign tag when there
 * is one — "dla-wlascicieli?z=mail". Without it /admin/leady cannot tell a reply
 * to the outreach mail from organic traffic. Fits the API's 80-char limit.
 */
export function leadSource(base: string): string {
  let tag: string | null = null;
  try {
    tag = clean(window.sessionStorage.getItem(STORAGE_KEY));
  } catch {
    // Fall through to the URL.
  }
  tag ??= clean(new URLSearchParams(window.location.search).get("z"));
  return tag ? `${base}?z=${tag}` : base;
}
