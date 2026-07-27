import { describe, expect, it } from "vitest";
import { updateProfileSchema } from "@/modules/users/schemas";

/**
 * This schema is the whole of RODO art. 16 in this product: it decides what a
 * person is allowed to correct about themselves, and what "I left that field
 * alone" means as opposed to "wipe it". Getting the second distinction wrong
 * would let a form that submits three inputs erase the two nobody touched.
 */
describe("updateProfileSchema", () => {
  it("normalises a typed phone number to E.164", () => {
    expect(updateProfileSchema.parse({ phone: "601 234 567" }).phone).toBe("+48601234567");
    expect(updateProfileSchema.parse({ phone: "+48 601-234-567" }).phone).toBe("+48601234567");
  });

  it("rejects a number that could never receive an SMS", () => {
    expect(() => updateProfileSchema.parse({ phone: "12345" })).toThrow();
    expect(() => updateProfileSchema.parse({ phone: "601 234 56789" })).toThrow();
  });

  it("treats an emptied field as a request to clear it, not as an error", () => {
    expect(updateProfileSchema.parse({ phone: "" }).phone).toBeNull();
    expect(updateProfileSchema.parse({ phone: "   " }).phone).toBeNull();
    expect(updateProfileSchema.parse({ firstName: "" }).firstName).toBeNull();
    expect(updateProfileSchema.parse({ phone: null }).phone).toBeNull();
  });

  it("keeps an absent field absent, so the update never touches it", () => {
    const parsed = updateProfileSchema.parse({ firstName: "Jan" });
    expect(parsed.firstName).toBe("Jan");
    expect(parsed.phone).toBeUndefined();
    expect(parsed.lastName).toBeUndefined();
    expect(Object.keys(parsed)).toEqual(["firstName"]);
  });

  it("trims names and turns down the ones that would not fit the column", () => {
    expect(updateProfileSchema.parse({ firstName: "  Jan  " }).firstName).toBe("Jan");
    expect(updateProfileSchema.parse({ lastName: "Ż".repeat(80) }).lastName).toHaveLength(80);
    expect(() => updateProfileSchema.parse({ lastName: "Ż".repeat(81) })).toThrow();
  });

  it("refuses an empty patch — nothing to save is a client bug, not a no-op", () => {
    expect(() => updateProfileSchema.parse({})).toThrow();
  });

  it("does not accept an e-mail change through this door", () => {
    const parsed = updateProfileSchema.parse({
      firstName: "Jan",
      email: "nowy@example.com",
    } as Record<string, unknown>);
    expect(parsed).not.toHaveProperty("email");
  });
});
