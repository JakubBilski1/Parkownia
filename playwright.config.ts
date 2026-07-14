import { defineConfig, devices } from "@playwright/test";

/**
 * Fixtures talk to the same Postgres the app does (issue an action token, plant a
 * booking, read back what the UI wrote). Node 22 can load the env file itself, so
 * this needs no dotenv dependency. Without it DATABASE_URL is undefined and the
 * fixtures fail with a less obvious error than this one.
 */
process.loadEnvFile(".env.local");

/**
 * The e2e port is NOT 3000: a dev server the developer already has open on 3000
 * would otherwise be adopted by `reuseExistingServer` and the suite would run
 * against whatever code that process happened to compile.
 */
const PORT = Number(process.env.E2E_PORT ?? 3200);
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * `next dev`, not `next build && next start`, and that is a constraint of the
 * product rather than a preference: MockPaymentProvider.verifyWebhook() refuses
 * to accept a webhook when NODE_ENV=production (src/modules/payments/mock.ts) —
 * a deliberate control, because a live mock endpoint would let anyone POST
 * themselves a paid booking. Under a production build the purchase path is
 * therefore dead by design, and it is the single most important path we test.
 *
 * The cost is dev-mode compilation: the first hit on a route can take ~20 s.
 * That is what the long timeouts below pay for.
 */
export default defineConfig({
  testDir: "./tests/e2e",

  // Every spec creates bookings, flips parkings to ACTIVE and burns tokens in one
  // shared database. Run them in file order, one at a time: parallel workers here
  // buy the same spot twice and then argue about who broke the assertion.
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },

  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    locale: "pl-PL",
    timezoneId: "Europe/Warsaw",
    // The driver we design for is holding a phone in the rain, not sitting at a
    // 27-inch monitor. Test at the width the product is actually used at.
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: false,
    permissions: [],
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        launchOptions: {
          // MapLibre is WebGL. Headless Chromium renders it through SwiftShader,
          // but only if GL is not disabled — without these the map never fires
          // `load`, no viewport is emitted, and not a single price pin exists.
          args: [
            "--use-gl=swiftshader",
            "--enable-unsafe-swiftshader",
            "--ignore-gpu-blocklist",
            "--enable-webgl",
          ],
        },
      },
    },
  ],

  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    // A cold `next dev` boot plus the first route compile is slow. Failing here
    // because we were impatient would look exactly like a broken app.
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      // The suite asserts on the mock payment flow and reads no mailbox.
      PAYMENT_PROVIDER: "mock",
      EMAIL_PROVIDER: "console",
      NEXT_PUBLIC_APP_URL: BASE_URL,
    },
  },
});
