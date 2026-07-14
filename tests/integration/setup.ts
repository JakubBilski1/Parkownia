import { afterAll, afterEach, beforeAll, vi } from "vitest";

/**
 * `next/headers` is the one thing these tests replace — see request-scope.ts for
 * why, and for what is deliberately NOT replaced. Declared in a setup file so it
 * applies to every integration test file without six copies of the same factory.
 */
vi.mock("next/headers", async () => {
  const { cookieStore, currentScope } = await import("./request-scope");
  return {
    cookies: async () => cookieStore(),
    headers: async () => currentScope().headers,
    draftMode: async () => ({ isEnabled: false, enable: () => {}, disable: () => {} }),
  };
});

const { cleanupTestData, closeDb } = await import("./fixtures");

// Leftovers from a run that crashed mid-test would otherwise be counted as
// occupancy by the next one — a "double booking" failure with no bug behind it.
beforeAll(async () => {
  await cleanupTestData();
});

afterEach(async () => {
  await cleanupTestData();
});

afterAll(async () => {
  await cleanupTestData();
  await closeDb();
});
