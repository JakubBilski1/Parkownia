import path from "node:path";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Two suites, two contracts:
 *
 *   unit        — `npm test`. Pure logic. Never opens a socket: no database, no
 *                 Docker, no server. Must stay runnable on a fresh clone.
 *   integration — `npm run test:integration`. The real modules against a real
 *                 PostgreSQL + PostGIS. Row locks, ON CONFLICT and `now()` are
 *                 the things under test, so a mocked database would test nothing.
 *
 * Both are declared here; the scripts pick one with `--project`. That is what
 * keeps `npm test` green on a laptop with no database — and what stops CI from
 * quietly skipping the suite that guards the money, which is the failure mode of
 * "run the integration tests only if a database happens to be configured".
 *
 * tests/README.md explains how to bring the database up.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const alias = { "@": path.resolve(__dirname, "./src") };

  // src/db/index.ts throws on *import* when DATABASE_URL is missing, so a pure
  // function that merely lives in a file next to a query would be untestable
  // without this. postgres.js is lazy — an unused URL costs a string, not a
  // connection — and this port is deliberately one nothing can listen on, so a
  // unit test that reaches for the database fails loudly instead of quietly
  // finding the developer's dev data.
  const unitEnv = {
    ...env,
    DATABASE_URL: env.DATABASE_URL || "postgresql://unit:unit@127.0.0.1:1/unit-must-not-connect",
  };

  const integrationEnv = {
    ...env,
    // The whole application reads DATABASE_URL. Pointing it at the throwaway
    // database is what lets createBooking() and handleWebhook() — the real
    // functions, not copies of them — run against data we may destroy.
    DATABASE_URL: env.TEST_DATABASE_URL ?? "",
    PAYMENT_PROVIDER: "mock",
    EMAIL_PROVIDER: "console",
    SMS_ENABLED: "false",
  };

  return {
    resolve: { alias },
    test: {
      projects: [
        {
          // The e-mail templates are .tsx and are reached through the booking
          // notification path, so JSX must be transformed in both suites:
          // tsconfig says `jsx: preserve` for Next, which esbuild alone would
          // hand to Node verbatim.
          plugins: [react()],
          resolve: { alias },
          test: {
            name: "unit",
            environment: "node",
            include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
            env: unitEnv,
          },
        },
        {
          plugins: [react()],
          resolve: { alias },
          test: {
            name: "integration",
            environment: "node",
            include: ["tests/integration/**/*.test.ts"],
            env: integrationEnv,
            globalSetup: ["tests/integration/global-setup.ts"],
            setupFiles: ["tests/integration/setup.ts"],
            // One database, one set of row locks. Files that truncated each
            // other's fixtures in parallel would be testing the harness, not the
            // application. Concurrency *inside* a test is the whole point (see
            // double-booking.test.ts) and is untouched by this.
            fileParallelism: false,
            testTimeout: 30_000,
            hookTimeout: 30_000,
          },
        },
      ],
    },
  };
});
