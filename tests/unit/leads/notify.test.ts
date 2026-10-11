import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notifyNewLead } from "@/modules/leads/notify";
import type { LeadInput } from "@/modules/leads/schemas";
import { setEmailProvider } from "@/modules/notifications";
import type { EmailMessage, EmailProvider, SendResult } from "@/modules/notifications";

function capturing(result: SendResult = { ok: true }) {
  const sent: EmailMessage[] = [];
  const provider: EmailProvider = {
    name: "capture",
    async send(message) {
      sent.push(message);
      return result;
    },
  };
  return { provider, sent };
}

const INPUT: LeadInput = {
  address: "ul. Bułgarska 17, Poznań",
  spots: 12,
  contactName: "Jan",
  phone: "600100200",
  contactPreference: "PHONE",
  privacyConsent: true,
  marketingEmailConsent: false,
  marketingPhoneConsent: true,
  objectType: "COMPANY_LOT",
  ownerKind: "BUSINESS",
} as LeadInput;

// E-mail only, never placed on the map: every optional field is absent.
const BARE: LeadInput = {
  address: "Poznań, Grunwald",
  spots: 1,
  contactName: "Ola",
  email: "ola@example.com",
  contactPreference: "EMAIL",
  privacyConsent: true,
  marketingEmailConsent: false,
  marketingPhoneConsent: false,
} as LeadInput;

const NO_ESTIMATE = {
  estimatedRateGr: null,
  estimatedAnnualGrossGr: null,
  eventsInReach: null,
  walkMinutesEnea: null,
  walkMinutesMtp: null,
};

const BLOCK_HELPERS = new Set(["if", "else", "each", "unless", "with", "this"]);

/**
 * The variable names pbdevs pulls out of a template on save, by the same rule as
 * its extract-variables.ts: every top-level identifier inside {{ }}, block helper
 * names dropped, and the WHOLE source scanned — an HTML comment included.
 */
function templateVariables(source: string): string[] {
  const found = new Set<string>();
  for (const [, raw = ""] of source.matchAll(/\{\{~?\s*([^}]*?)\s*~?\}\}/g)) {
    let body = raw.trim();
    if (!body || /^[/>!]/.test(body) || body === "else") continue;
    if (body.startsWith("#")) body = body.slice(1).trim().replace(/^\S+\s*/, "");
    for (const token of body.split(/[\s,()|=]+/)) {
      const ident = token.split(".")[0] ?? "";
      if (/^[a-zA-Z_]\w*$/.test(ident) && !BLOCK_HELPERS.has(ident)) found.add(ident);
    }
  }
  return [...found];
}

const OWNER_LEAD_TEMPLATE = readFileSync(
  join(process.cwd(), "docs/mail-templates/owner-lead.mjml"),
  "utf8",
);

const ESTIMATE = {
  estimatedRateGr: 5500,
  estimatedAnnualGrossGr: 462_000,
  eventsInReach: 17,
  walkMinutesEnea: 4,
  walkMinutesMtp: null,
};

describe("lead alert", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    setEmailProvider(undefined);
    vi.restoreAllMocks();
  });

  it("mails the internal address, never the lead", async () => {
    const { provider, sent } = capturing();
    setEmailProvider(provider);
    process.env.LEAD_ALERT_EMAIL = "leady@parkownia.com";

    await notifyNewLead("11111111-1111-4111-8111-111111111111", INPUT, ESTIMATE);

    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("leady@parkownia.com");
    expect(sent[0]!.template).toBe("owner-lead");
  });

  it("hands the renderer display-ready values, not raw grosze", async () => {
    const { provider, sent } = capturing();
    setEmailProvider(provider);

    await notifyNewLead("22222222-2222-4222-8222-222222222222", INPUT, ESTIMATE);

    const data = sent[0]!.data;
    expect(data.estimatedRate).toBe("55 zł");
    // The separator depends on the ICU data available, the zloty amount does not.
    expect(data.estimatedAnnual).toMatch(/^4\s?620 zł$/);
    // Straight-line minutes must never be presented as a walked route (CLAUDE.md).
    expect(data.walkEnea).toBe("ok. 4 min");
    expect(data.walkMtp).toBe("");
    expect(data.objectType).toBe("Parking firmowy");
    expect(data.ownerKind).toBe("Firma");
    expect(data.contactLine).toContain("600100200");
  });

  it("never hands the mail API a null — pbdevs rejects the whole send with 422", async () => {
    const { provider, sent } = capturing();
    setEmailProvider(provider);

    await notifyNewLead("66666666-6666-4666-8666-666666666666", BARE, NO_ESTIMATE);

    const data = sent[0]!.data;
    for (const [key, value] of Object.entries(data)) {
      expect(value, key).not.toBeNull();
      expect(value, key).not.toBeUndefined();
    }
    // Never placed on the map: the template's estimate branch must read as absent.
    expect(data.eventsInReach).toBe("");
    expect(data.phone).toBe("");
  });

  it("sends a value for every variable the owner-lead template names", async () => {
    const required = templateVariables(OWNER_LEAD_TEMPLATE);
    expect(required).toContain("contactName");

    for (const [input, estimate] of [
      [INPUT, ESTIMATE],
      [BARE, NO_ESTIMATE],
    ] as const) {
      const { provider, sent } = capturing();
      setEmailProvider(provider);
      await notifyNewLead("77777777-7777-4777-8777-777777777777", input, estimate);

      const data = sent[0]!.data;
      expect(required.filter((key) => data[key] === undefined || data[key] === null)).toEqual([]);
    }
  });

  it("keeps a real zero events in reach visible to the template", async () => {
    const { provider, sent } = capturing();
    setEmailProvider(provider);

    await notifyNewLead("88888888-8888-4888-8888-888888888888", INPUT, {
      ...ESTIMATE,
      eventsInReach: 0,
      estimatedRateGr: null,
      estimatedAnnualGrossGr: null,
    });

    // "0" is truthy in Handlebars, so the alert says "0" instead of claiming the
    // address was never placed on the map.
    expect(sent[0]!.data.eventsInReach).toBe("0");
  });

  it("dedupes on the lead id so a retried request cannot double-mail", async () => {
    const { provider, sent } = capturing();
    setEmailProvider(provider);

    await notifyNewLead("33333333-3333-4333-8333-333333333333", INPUT, ESTIMATE);

    expect(sent[0]!.idempotencyKey).toBe("owner-lead:33333333-3333-4333-8333-333333333333");
  });

  it("swallows a refused send — the lead is already saved", async () => {
    const { provider } = capturing({ ok: false, reason: "pbdevs 404: no such template" });
    setEmailProvider(provider);

    await expect(
      notifyNewLead("44444444-4444-4444-8444-444444444444", INPUT, ESTIMATE),
    ).resolves.toBeUndefined();
  });

  it("swallows a provider that throws", async () => {
    setEmailProvider({
      name: "broken",
      send() {
        throw new Error("EMAIL_PROVIDER=\"pbdevs\" requires MAIL_API_KEY.");
      },
    });

    await expect(
      notifyNewLead("55555555-5555-4555-8555-555555555555", INPUT, ESTIMATE),
    ).resolves.toBeUndefined();
  });
});
