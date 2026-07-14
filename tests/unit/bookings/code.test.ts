import { describe, expect, it } from "vitest";
import {
  CODE_PATTERN,
  generateBookingCode,
  hashBookingCode,
  isBookingCode,
  normalizeBookingCode,
} from "@/modules/bookings/code";

describe("booking code", () => {
  it("never contains a character that gets misread at a barrier", () => {
    const forbidden = /[O0I1]/;
    for (let i = 0; i < 2000; i += 1) {
      const code = generateBookingCode();
      expect(code.slice(3).replace("-", "")).not.toMatch(forbidden);
    }
  });

  it("always matches the PK-XXXX-XXXX shape", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(CODE_PATTERN.test(generateBookingCode())).toBe(true);
    }
  });

  it("spreads over the alphabet instead of favouring a corner of it", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i += 1) {
      for (const char of generateBookingCode().replace(/^PK-|-/g, "")) seen.add(char);
    }
    // 32 symbols; anything much below that means the masking is biased.
    expect(seen.size).toBe(32);
  });

  it("does not collide across a realistic volume of bookings", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 20000; i += 1) codes.add(generateBookingCode());
    expect(codes.size).toBe(20000);
  });

  it("hashes to sha256 hex, stably, case-insensitively", () => {
    const hash = hashBookingCode("PK-7H2K-M4RT");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashBookingCode("pk-7h2k-m4rt")).toBe(hash);
    expect(hashBookingCode("PK-7H2K-M4RU")).not.toBe(hash);
  });

  it("accepts what a person types by hand", () => {
    expect(normalizeBookingCode("pk 7h2k m4rt")).toBe("PK-7H2K-M4RT");
    expect(normalizeBookingCode("PK7H2KM4RT")).toBe("PK-7H2K-M4RT");
    expect(normalizeBookingCode("7H2KM4RT")).toBe("PK-7H2K-M4RT");
    expect(normalizeBookingCode("PK-7H2K")).toBeNull();
    // O and I are not in the alphabet: a code containing them is not our code.
    expect(normalizeBookingCode("PK-7H2K-M4RO")).toBeNull();
  });

  it("rejects malformed codes", () => {
    expect(isBookingCode("PK-7H2K-M4RT")).toBe(true);
    expect(isBookingCode("XX-7H2K-M4RT")).toBe(false);
    expect(isBookingCode("PK-7H2K-M4R")).toBe(false);
  });
});
