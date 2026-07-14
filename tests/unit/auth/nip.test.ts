import { describe, expect, it } from "vitest";
import { isValidNip, normalizeNip } from "@/modules/auth/nip";

describe("normalizeNip", () => {
  it("strips the separators people actually type", () => {
    expect(normalizeNip("123-456-32-18")).toBe("1234563218");
    expect(normalizeNip("123 456 32 18")).toBe("1234563218");
    expect(normalizeNip("PL1234563218")).toBe("1234563218");
    expect(normalizeNip("pl 123-45-63-218")).toBe("1234563218");
  });
});

describe("isValidNip", () => {
  it("accepts real NIPs", () => {
    // Checksums verified independently: weights 6,5,7,2,3,4,5,6,7 mod 11.
    expect(isValidNip("1234563218")).toBe(true);
    expect(isValidNip("5261040828")).toBe(true);
    expect(isValidNip("7773174094")).toBe(true);
    expect(isValidNip("777-317-40-94")).toBe(true);
  });

  it("rejects a single mistyped digit", () => {
    expect(isValidNip("1234563219")).toBe(false);
    expect(isValidNip("5261040829")).toBe(false);
  });

  it("rejects anything that is not ten digits", () => {
    expect(isValidNip("")).toBe(false);
    expect(isValidNip("123456321")).toBe(false);
    expect(isValidNip("12345632180")).toBe(false);
    expect(isValidNip("abcdefghij")).toBe(false);
  });

  it("rejects repeated digits, which pass the checksum but do not exist", () => {
    expect(isValidNip("0000000000")).toBe(false);
    expect(isValidNip("1111111111")).toBe(false);
  });

  it("rejects numbers whose checksum lands on 10", () => {
    // sum mod 11 === 10 — a check digit that cannot be written as one digit, so
    // no such NIP exists, whatever the tenth digit says.
    expect(isValidNip("1000000160")).toBe(false);
    expect(isValidNip("1000000161")).toBe(false);
  });
});
