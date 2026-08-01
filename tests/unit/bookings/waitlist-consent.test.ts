import { describe, expect, it } from "vitest";
import { waitlistInputSchema } from "@/modules/bookings/waitlist";

/**
 * The waiting list shipped, briefly, as a one-field form: an e-mail box, a
 * button, and no consent, no link to the policy, and no record of which version
 * of it was in force. The mail that list exists to send is a commercial
 * communication however friendly the wording, and art. 398 PKE wants consent
 * before one (docs/LEGAL_RESEARCH.md — it covers B2B too).
 *
 * The checkbox in the form is a courtesy. This is the rule: the server will not
 * store an address it could never lawfully write to.
 */
describe("waitlist consent", () => {
  const valid = { email: "jan@example.pl", privacyConsent: true as const };

  it("accepts an address that came with consent", () => {
    expect(waitlistInputSchema.safeParse(valid).success).toBe(true);
  });

  it("refuses an address with no consent field at all", () => {
    expect(waitlistInputSchema.safeParse({ email: "jan@example.pl" }).success).toBe(false);
  });

  it("refuses a consent that is present but false", () => {
    const result = waitlistInputSchema.safeParse({ ...valid, privacyConsent: false });
    expect(result.success).toBe(false);
  });

  it("refuses a truthy value that is not the boolean true", () => {
    // A client sending "true" or 1 must not slip past — consent is a fact we
    // will have to prove, not a value we coerce.
    for (const sneaky of ["true", 1, "on", {}]) {
      expect(
        waitlistInputSchema.safeParse({ ...valid, privacyConsent: sneaky }).success,
        `accepted ${JSON.stringify(sneaky)} as consent`,
      ).toBe(false);
    }
  });

  it("still rejects a malformed address even with consent ticked", () => {
    expect(waitlistInputSchema.safeParse({ ...valid, email: "nie-adres" }).success).toBe(false);
  });
});
