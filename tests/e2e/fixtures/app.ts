import { expect, type APIRequestContext, type Page } from "@playwright/test";
import {
  SEED_PASSWORD,
  bookingById,
  resetRateLimits,
  sql,
  type BookingRow,
} from "./db";

/**
 * Logs in the way the product does — POST /api/auth/login — and lets the response
 * plant `ps_access` / `ps_refresh`. `page.request` shares its cookie jar with the
 * browser context, so every subsequent navigation on `page` is authenticated.
 *
 * The rate-limit table is cleared first: /api/auth/* allows 5 requests a minute
 * per IP, and a suite that logs in six times would otherwise fail its sixth spec
 * with a 429 that says nothing about the product.
 */
export async function loginAs(page: Page, email: string, password = SEED_PASSWORD): Promise<void> {
  await resetRateLimits();

  const response = await page.request.post("/api/auth/login", {
    data: { email, password },
  });

  expect(
    response.ok(),
    `login as ${email} failed: ${response.status()} ${await response.text()}`,
  ).toBeTruthy();
}

export async function logout(page: Page): Promise<void> {
  await page.request.post("/api/auth/logout").catch(() => undefined);
  await page.context().clearCookies();
}

/* -------------------------------------------------------------------------- */
/* Buying a spot without a browser                                            */
/* -------------------------------------------------------------------------- */

export type PurchaseInput = {
  parkingId: string;
  eventId: string;
  email: string;
  phone?: string;
  spots?: number;
};

/**
 * The three calls the checkout screen makes, in the order it makes them:
 *
 *   POST /api/bookings         → PENDING hold, price computed on the server
 *   POST /api/payments/intent  → { providerRef, simulated: true } from the mock PSP
 *   POST /api/webhooks/mock    → the bank's answer, travelling the real webhook
 *                                path (signature check, idempotency, amount match)
 *
 * The scan specs need a paid booking to exist before a host can be shown refusing
 * or admitting it. They buy one here rather than INSERTing it, so the code, the
 * hash and the CONFIRMED status are all produced by the code that will produce
 * them in production.
 *
 * Note there is no `amount` anywhere below. The contract has no field for one.
 */
export async function purchaseBooking(
  request: APIRequestContext,
  input: PurchaseInput,
): Promise<BookingRow> {
  await resetRateLimits();

  const bookingResponse = await request.post("/api/bookings", {
    data: {
      parkingId: input.parkingId,
      eventId: input.eventId,
      spots: input.spots ?? 1,
      contact: { email: input.email, phone: input.phone ?? "601234567" },
      consents: { terms: true, privacy: true },
    },
  });

  expect(
    bookingResponse.ok(),
    `POST /api/bookings failed: ${bookingResponse.status()} ${await bookingResponse.text()}`,
  ).toBeTruthy();

  const { bookingId } = (await bookingResponse.json()) as { bookingId: string };

  const intentResponse = await request.post("/api/payments/intent", {
    data: { bookingId, method: "BLIK" },
  });
  expect(
    intentResponse.ok(),
    `POST /api/payments/intent failed: ${intentResponse.status()} ${await intentResponse.text()}`,
  ).toBeTruthy();

  const intent = (await intentResponse.json()) as { providerRef: string; simulated?: boolean };
  expect(intent.simulated, "PAYMENT_PROVIDER must be `mock` for the e2e run").toBe(true);

  const webhookResponse = await request.post("/api/webhooks/mock", {
    data: {
      id: crypto.randomUUID(),
      type: "PAYMENT_SUCCEEDED",
      providerRef: intent.providerRef,
      bookingId,
    },
  });
  expect(
    webhookResponse.ok(),
    `POST /api/webhooks/mock failed: ${webhookResponse.status()} ${await webhookResponse.text()}`,
  ).toBeTruthy();

  const booking = await bookingById(bookingId);
  if (!booking) throw new Error(`Booking ${bookingId} vanished after payment`);

  expect(
    booking.status,
    "the mock webhook should have moved the booking to CONFIRMED",
  ).toBe("CONFIRMED");

  return booking;
}

/* -------------------------------------------------------------------------- */
/* Waiting for what the browser wrote                                         */
/* -------------------------------------------------------------------------- */

/**
 * Polls the database until `check` is happy. Used where the UI fires a request
 * and does not wait for it (the offline queue drains in the background), so there
 * is no DOM signal to attach an expectation to.
 */
export async function waitForRow<T>(
  read: () => Promise<T | undefined>,
  check: (row: T) => boolean,
  { timeoutMs = 20_000, intervalMs = 250, what = "row" } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T | undefined;

  while (Date.now() < deadline) {
    last = await read();
    if (last !== undefined && check(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Timed out after ${timeoutMs} ms waiting for ${what}. Last seen: ${JSON.stringify(last)}`,
  );
}

/** A unique address per run, inside the domain cleanup sweeps. */
export function e2eEmail(prefix: string): string {
  return `e2e-${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@parkownia.test`;
}

export { sql };
