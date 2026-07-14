import { hash, verify, type Algorithm, type Options } from "@node-rs/argon2";

/**
 * Argon2id with OWASP's second recommended profile (19 MiB, t=2, p=1).
 *
 * The algorithm is spelled as the literal 2 (Algorithm.Argon2id): the binding
 * declares an ambient `const enum`, which cannot be read at runtime under
 * `isolatedModules`. The type import keeps the value checked against it.
 */
const OPTIONS: Options = {
  algorithm: 2 as Algorithm,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, password, OPTIONS);
  } catch {
    return false;
  }
}

/**
 * Burns the same CPU as a real verification when the account does not exist (or
 * has no password set yet). Without it, response time tells an attacker which
 * e-mails are registered — and login is not allowed to reveal that.
 *
 * The decoy is hashed once at first use rather than hard-coded: a hard-coded
 * string that stops parsing (parameter change, library upgrade) would fail fast
 * and silently restore the timing oracle.
 */
let decoyHash: Promise<string> | null = null;

export async function burnPasswordTime(password: string): Promise<void> {
  decoyHash ??= hashPassword("decoy-password-not-in-use");
  await verifyPassword(await decoyHash, password);
}
