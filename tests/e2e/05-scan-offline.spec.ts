import { expect, test, type Page } from "@playwright/test";
import { e2eEmail, loginAs, purchaseBooking, waitForRow } from "./fixtures/app";
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
} from "./fixtures/db";

/**
 * THE OFFLINE GATE (CLAUDE.md — "Skaner QR bez internetu").
 *
 *   "Przy 40 tys. ludzi pod stadionem sieć komórkowa pada. Kody na dany event
 *    muszą być pobrane do IndexedDB ZANIM event się zacznie, walidowane lokalnie,
 *    synchronizowane po odzyskaniu sieci."
 *
 * Every other test in this suite could pass with the network up and the offline
 * module a dead letter. This is the one that cannot: the browser is really taken
 * offline (context.setOffline), the gate has to answer from IndexedDB alone, and
 * the server must learn about it afterwards. Without this test the whole offline
 * story is a claim in a document.
 */

const SCAN_OK = "rgb(15, 123, 79)";

type Gate = { event: EventRow; booking: BookingRow };

async function armGate(page: Page): Promise<Gate> {
  const parking = await eventPricedParkingOf(ACCOUNTS.host);
  const event = await createLiveEvent(`E2E Offline ${Date.now()}`);

  await declareAvailability({
    eventId: event.id,
    parkingId: parking.id,
    spots: parking.capacity ?? 5,
    priceGr: parking.price_per_event_gr ?? 3000,
  });

  const booking = await purchaseBooking(page.request, {
    parkingId: parking.id,
    eventId: event.id,
    email: e2eEmail("offline"),
  });

  return { event, booking };
}

test.describe("Skaner offline — brak zasięgu pod stadionem", () => {
  test.beforeEach(async () => {
    await resetRateLimits();
  });

  test.afterAll(async () => {
    await cleanupE2eArtifacts();
  });

  test("kody pobrane wcześniej → skan działa bez sieci → synchronizuje się po powrocie", async ({
    page,
    context,
  }) => {
    await loginAs(page, ACCOUNTS.host);
    const gate = await armGate(page);

    /* --------------------------------- 1. at home, on Wi-Fi: pull the codes down */

    await page.goto("/panel/skaner");

    const row = page
      .locator("div")
      .filter({ hasText: gate.event.title })
      .filter({ has: page.getByRole("button", { name: "Pobierz" }) })
      .last();
    await row.getByRole("button", { name: "Pobierz" }).click();

    await expect(page.getByText(/Kody pobrane/)).toBeVisible({ timeout: 20_000 });

    // The package is on the device, not in a variable: a reload at the barrier
    // (dead battery, backgrounded tab) must not lose it.
    const stored = await page.evaluate(async () => {
      const open = indexedDB.open("parkownia-scan", 1);
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      const tx = db.transaction("manifests", "readonly");
      const all = tx.objectStore("manifests").getAll();
      return new Promise<Array<{ eventId: string; entries: unknown[] }>>((resolve, reject) => {
        all.onsuccess = () => resolve(all.result);
        all.onerror = () => reject(all.error);
      });
    });

    const manifest = stored.find((item) => item.eventId === gate.event.id);
    expect(manifest, "no manifest in IndexedDB — the gate will be dead at the stadium").toBeTruthy();
    expect(manifest!.entries.length).toBeGreaterThan(0);

    /* ------------------------------------------ 2. the cell tower gives up */

    await context.setOffline(true);
    await expect(page.getByText("Brak sieci")).toBeVisible();

    /* ---------------------------- 3. the gate answers anyway, from the device */

    // Nothing may reach the server while we are offline. If a verdict came from
    // there, this test would be proving the opposite of what it claims.
    const leaked: string[] = [];
    page.on("request", (request) => {
      if (/\/api\/scan\/(validate|manual)/.test(request.url())) leaked.push(request.url());
    });

    await page.getByRole("button", { name: "Wpisz kod ręcznie" }).click();
    await page.getByLabel("Kod rezerwacji").fill(gate.booking.code);
    await page.getByRole("button", { name: "Sprawdź kod" }).click();

    const verdict = page.getByRole("alert").filter({ hasText: "WPUŚĆ" });
    await expect(verdict, "the gate could not answer without a network").toBeVisible({
      timeout: 20_000,
    });
    await expect(verdict).toHaveCSS("background-color", SCAN_OK);

    // It says so, too: the host must know the scan is queued, not lost.
    await expect(verdict).toContainText(/Zapisano offline/);

    // The server cannot have been consulted, and cannot have been told.
    const duringOutage = await bookingById(gate.booking.id);
    expect(
      duringOutage?.status,
      "the booking changed server-side during the outage — the verdict was not local",
    ).toBe("CONFIRMED");

    /* ------------------------------------------ 4. the network comes back */

    await context.setOffline(false);
    await expect(page.getByText("Sieć jest")).toBeVisible({ timeout: 20_000 });

    // startAutoSync() listens for `online` and drains the queue by itself. The host
    // does nothing: he is looking at a car, not at a sync button.
    const synced = await waitForRow(
      () => bookingById(gate.booking.id),
      (booking) => booking.status === "USED",
      { timeoutMs: 30_000, what: "the offline scan to reach the server" },
    );
    expect(synced.status).toBe("USED");

    const scans = await scansOf(gate.booking.id);
    const admitted = scans.filter((scan) => scan.result === "ADMITTED");
    expect(admitted).toHaveLength(1);
    expect(admitted[0]?.offline, "the scan should be recorded as having happened offline").toBe(
      true,
    );
    expect(admitted[0]?.conflict).toBe(false);

    // The queue is empty: nothing is waiting, and nothing was sent twice.
    const queued = await page.evaluate(async () => {
      const open = indexedDB.open("parkownia-scan", 1);
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      const tx = db.transaction("queue", "readonly");
      const count = tx.objectStore("queue").count();
      return new Promise<number>((resolve, reject) => {
        count.onsuccess = () => resolve(count.result);
        count.onerror = () => reject(count.error);
      });
    });
    expect(queued, "scans left stranded in the offline queue after sync").toBe(0);

    expect(leaked, "the scanner called the server while offline").toEqual([]);
  });

  test("bez sieci i bez pobranych kodów skaner nie zgaduje", async ({ page, context }) => {
    await loginAs(page, ACCOUNTS.host);

    // A host who never pulled the codes is the case the product must not bluff its
    // way through. "Nie wiem" is the only honest answer, and the setup screen gives
    // it: it refuses to open a gate it has no way to verify.
    //
    // NOTE: the page is loaded first and the radio killed after. Reloading while
    // offline is the Service Worker's job (public/sw.js precaches /panel/skaner),
    // and PwaRegister deliberately registers only under NODE_ENV=production — which
    // this suite cannot use, because the mock PSP refuses to run there. The offline
    // SHELL is therefore not covered here; the offline VERDICT, above, is.
    await page.goto("/panel/skaner");
    await expect(page.getByRole("heading", { name: "Skaner" })).toBeVisible();

    await context.setOffline(true);

    await expect(page.getByText("Nie masz jeszcze kodów na żaden event")).toBeVisible();
    await expect(page.getByText(/Brak sieci\./)).toBeVisible();

    // No codes, no gate, no guessing — and so no way to admit a car on a hunch.
    await expect(page.getByRole("button", { name: "Wpisz kod ręcznie" })).toHaveCount(0);

    await context.setOffline(false);
  });
});
