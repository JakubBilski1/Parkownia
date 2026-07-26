import { describe, expect, it } from "vitest";
import { generateTempPassword } from "@/modules/admin/clients";

/**
 * This password is read down the phone: "K" and "H" have to be distinguishable by
 * ear, and 0/O and 1/l/I by eye on the note the client writes. It is also the only
 * credential that account has until they change it, so it must not be guessable.
 */
describe("generateTempPassword", () => {
  it("has four blocks of four, separated by dashes", () => {
    expect(generateTempPassword()).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
  });

  it("never contains a look-alike character", () => {
    const forbidden = /[0O1lI]/;
    for (let i = 0; i < 200; i += 1) {
      expect(generateTempPassword()).not.toMatch(forbidden);
    }
  });

  it("does not repeat itself", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) seen.add(generateTempPassword());
    // 31^16 of space: a single collision in 500 draws would mean the generator is
    // not random, not that we got unlucky.
    expect(seen.size).toBe(500);
  });
});
