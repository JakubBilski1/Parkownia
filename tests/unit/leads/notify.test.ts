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
    expect(data.walkMtp).toBeNull();
    expect(data.objectType).toBe("Parking firmowy");
    expect(data.ownerKind).toBe("Firma");
    expect(data.contactLine).toContain("600100200");
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
