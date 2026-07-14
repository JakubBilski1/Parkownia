import { expect, test, type Page } from "@playwright/test";
import { e2eEmail, loginAs, purchaseBooking } from "./fixtures/app";
import {
  ACCOUNTS,
  bookingById,
  cleanupE2eArtifacts,
  createLiveEvent,
  declareAvailability,
  eventPricedParkingOf,
  resetRateLimits,
  scansOf,
  type BookingRow,
  type EventRow,
  type ParkingRow,
} from "./fixtures/db";

/**
 * CRITICAL PATH 2 (docs/DESIGN_PRINCIPLES.md §7) — the host at the barrier, 200
 * people in the queue, sunlight on the screen.
 *
 *   "Odpowiedź: pełnoekranowy zielony z ✓ i wielkim WPUŚĆ albo pełnoekranowy
 *    czerwony z powodem odrzucenia. Zawsze widoczny przycisk «Wpisz kod ręcznie»."
 *
 * The camera is not available in headless Chromium (no BarcodeDetector), which is
 * not a limitation of the test but the exact condition the manual fallback exists
 * for: a dead camera, a cracked lens, a phone from 2016. So this drives the gate
 * the way a host with a broken camera drives it, and that path must be complete.
 */

/* The safety colours (src/app/globals.css). Identical in both themes, and
   deliberately NOT the brand accent — this is signage, not decoration. */
const SCAN_OK = "rgb(15, 123, 79)";
const SCAN_BAD = "rgb(179, 38, 30)";

/** scanner-screen.tsx ignores a repeat of the same code inside 3 s (a camera-frame guard). */
const REPEAT_GUARD_MS = 3_200;

type Gate = { event: EventRow; parking: ParkingRow; booking: BookingRow };

async function setUpGate(page: Page): Promise<Gate> {
  const parking = await eventPricedParkingOf(ACCOUNTS.host);
  const event = await createLiveEvent(`E2E Brama ${Date.now()}`);

  await declareAvailability({
    eventId: event.id,
    parkingId: parking.id,
    spots: parking.capacity ?? 5,
    priceGr: parking.price_per_event_gr ?? 3000,
  });

  // A real purchase, through the real endpoints — the code the host will type is
  // one the product minted, not one the test invented.
  const booking = await purchaseBooking(page.request, {
    parkingId: parking.id,
    eventId: event.id,
    email: e2eEmail("kibic"),
  });

  return { event, parking, booking };
}

/** Downloads the offline package and lands on the camera view. */
async function openGate(page: Page, event: EventRow): Promise<void> {
  await page.goto("/panel/skaner");

  await expect(page.getByRole("heading", { name: "Skaner" })).toBeVisible();

  // The innermost div that carries BOTH the event's name and its own download
  // button — i.e. the row. Filtering on the text alone lands on the label wrapper,
  // which has no button in it.
  const row = page
    .locator("div")
    .filter({ hasText: event.title })
    .filter({ has: page.getByRole("button", { name: "Pobierz" }) })
    .last();

  await row.getByRole("button", { name: "Pobierz" }).click();

  // The toast is the host's proof that the phone will work at the barrier.
  await expect(page.getByText(/Kody pobrane/)).toBeVisible({ timeout: 20_000 });
}

async function typeCode(page: Page, code: string): Promise<void> {
  await page.getByRole("button", { name: "Wpisz kod ręcznie" }).click();
  await page.getByLabel("Kod rezerwacji").fill(code);
  await page.getByRole("button", { name: "Sprawdź kod" }).click();
}

/** The whole screen is the answer: colour, word and icon, none of them load-bearing alone. */
async function expectVerdict(
  page: Page,
  tone: "ok" | "bad",
  headline: string,
  reason: string,
): Promise<void> {
  const overlay = page.getByRole("alert").filter({ hasText: headline });
  await expect(overlay).toBeVisible({ timeout: 20_000 });

  await expect(overlay.getByRole("heading", { name: headline })).toBeVisible();
  await expect(overlay).toContainText(reason);

  await expect(overlay).toHaveCSS(
    "background-color",
    tone === "ok" ? SCAN_OK : SCAN_BAD,
  );

  // "Pełnoekranowy" is a requirement, not a flourish: the host reads it at arm's
  // length. A verdict in a corner of the camera view would not be this test.
  const box = await overlay.boundingBox();
  const viewport = page.viewportSize();
  expect(box, "the verdict has no box").toBeTruthy();
  expect(box!.width).toBeGreaterThanOrEqual((viewport?.width ?? 0) - 1);
  expect(box!.height).toBeGreaterThanOrEqual((viewport?.height ?? 0) - 1);
}

test.describe("Ścieżka 2 — skan kodu przy bramie", () => {
  test.beforeEach(async () => {
    await resetRateLimits();
  });

  test.afterAll(async () => {
    await cleanupE2eArtifacts();
  });

  test("ważny kod → zielony WPUŚĆ; ten sam kod drugi raz → czerwony", async ({ page }) => {
    await loginAs(page, ACCOUNTS.host);
    const gate = await setUpGate(page);

    await openGate(page, gate.event);

    /* ------------------------------------ the fallback that must never be buried */

    // The camera cannot run here. The gate still has to work — that is the point.
    const manual = page.getByRole("button", { name: "Wpisz kod ręcznie" });
    await expect(
      manual,
      "„Wpisz kod ręcznie” must be reachable at all times (DESIGN_PRINCIPLES §7)",
    ).toBeVisible();

    /* --------------------------------------------------- first scan: let him in */

    await typeCode(page, gate.booking.code);
    await expectVerdict(page, "ok", "WPUŚĆ", "Kod ważny");

    // The screen said yes; the database has to agree, or the next gate says yes too.
    const used = await bookingById(gate.booking.id);
    expect(used?.status, "an admitted booking must be USED").toBe("USED");

    const scans = await scansOf(gate.booking.id);
    expect(scans.filter((scan) => scan.result === "ADMITTED")).toHaveLength(1);

    /* ------------------------------------------- second scan: the same code again */

    // The ADMITTED overlay clears itself (2.2 s) — the host's hands are on a car.
    await expect(page.getByRole("alert").filter({ hasText: "WPUŚĆ" })).toBeHidden({
      timeout: 10_000,
    });

    // The code is still visible on the manual button, so the queue never stalls.
    await expect(manual).toBeVisible();

    await page.waitForTimeout(REPEAT_GUARD_MS);
    await typeCode(page, gate.booking.code);

    await expectVerdict(page, "bad", "NIE WPUSZCZAJ", "Kod już użyty");

    // Refused, and it stays refused: one paid booking is one car.
    const stillUsed = await bookingById(gate.booking.id);
    expect(stillUsed?.status).toBe("USED");
    const after = await scansOf(gate.booking.id);
    expect(
      after.filter((scan) => scan.result === "ADMITTED"),
      "a second ADMITTED scan would be a car let in for free",
    ).toHaveLength(1);
    expect(after.filter((scan) => scan.result === "REJECTED_USED")).toHaveLength(1);
  });

  test("wymyślony kod → czerwony, bez wpuszczenia", async ({ page }) => {
    await loginAs(page, ACCOUNTS.host);
    const gate = await setUpGate(page);

    await openGate(page, gate.event);

    // Right shape, no booking behind it.
    await typeCode(page, "PK-2345-6789");
    await expectVerdict(page, "bad", "NIE WPUSZCZAJ", "Kod nieznany");

    const untouched = await bookingById(gate.booking.id);
    expect(untouched?.status, "the real booking must not have been consumed").toBe("CONFIRMED");
  });
});
