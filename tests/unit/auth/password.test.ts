import { describe, expect, it } from "vitest";
import { burnPasswordTime, hashPassword, verifyPassword } from "@/modules/auth/password";

describe("password hashing", () => {
  it("produces an Argon2id hash", async () => {
    const hash = await hashPassword("prawidlowe-haslo-10");
    expect(hash.startsWith("$argon2id$")).toBe(true);
  });

  it("salts: the same password hashes differently every time", async () => {
    const a = await hashPassword("prawidlowe-haslo-10");
    const b = await hashPassword("prawidlowe-haslo-10");
    expect(a).not.toBe(b);
  });

  it("verifies the right password and rejects the wrong one", async () => {
    const hash = await hashPassword("prawidlowe-haslo-10");
    expect(await verifyPassword(hash, "prawidlowe-haslo-10")).toBe(true);
    expect(await verifyPassword(hash, "prawidlowe-haslo-11")).toBe(false);
  });

  it("returns false instead of throwing on a corrupted hash", async () => {
    expect(await verifyPassword("not-a-hash", "prawidlowe-haslo-10")).toBe(false);
  });

  it("burns comparable time when the account does not exist", async () => {
    const hash = await hashPassword("prawidlowe-haslo-10");

    const startReal = performance.now();
    await verifyPassword(hash, "zle-haslo-tutaj");
    const real = performance.now() - startReal;

    const startDecoy = performance.now();
    await burnPasswordTime("zle-haslo-tutaj");
    const decoy = performance.now() - startDecoy;

    // Same order of magnitude is the whole point: a "no such user" answer must
    // not come back visibly faster than a "wrong password" one.
    expect(decoy).toBeGreaterThan(real / 5);
  }, 20_000);
});
