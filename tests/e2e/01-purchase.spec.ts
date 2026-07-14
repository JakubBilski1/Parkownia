import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { e2eEmail } from "./fixtures/app";
import {
  alwaysBookableParking,
  bookingByCode,
  cleanupE2eArtifacts,
  resetRateLimits,
  type ParkingRow,
} from "./fixtures/db";

/**
 * CRITICAL PATH 1 (docs/DESIGN_PRINCIPLES.md §7) — the driver in the rain, eight
 * minutes to kick-off:
 *
 *   map → price pin → "Zarezerwuj" → pay → code + QR
 *
 * Two things are under test beyond "it works":
 *
 *  1. THE ENTRY SECRET IS NOT GIVEN AWAY BEFORE THE MONEY. `access_instructions`
 *     ("Kod do szlabanu: 4417#") is what the driver is actually buying. If it is
 *     readable from the map sheet or the checkout, the product can be used for
 *     free and the API contract (docs/API_SPEC.md §3: "Nigdy nie zawiera
 *     access_instructions") is a lie.
 *
 *  2. THE TOUCH COUNT. The target is 4. We count what a thumb must actually hit
 *     and report the number rather than bending the UI to reach it.
 */

const CODE_PATTERN = /PK-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}/;
const HOURS_ON_CHECKOUT = 3; // /rezerwacja/:id with no ?godziny → the page's own default

/** A thumb hitting one control. Typing into a focused field is not counted again. */
class Taps {
  private count = 0;
  private readonly log: string[] = [];

  async tap(what: string, target: Locator): Promise<void> {
    this.count += 1;
    this.log.push(`${this.count}. ${what}`);
    await target.click();
  }

  /** Focus + type. Counted as ONE touch, which flatters the app: a real e-mail is ~20 keystrokes. */
  async type(what: string, target: Locator, value: string): Promise<void> {
    this.count += 1;
    this.log.push(`${this.count}. ${what} (+ wpisanie „${value}")`);
    await target.click();
    await target.fill(value);
  }

  get total(): number {
    return this.count;
  }

  report(testInfo: TestInfo): void {
    const summary = [
      `DOTKNIĘCIA od wejścia na stronę do kodu QR: ${this.count} (cel: 4)`,
      ...this.log.map((line) => `   ${line}`),
    ].join("\n");
    console.log(`\n${summary}\n`);
    testInfo.annotations.push({ type: "taps", description: `${this.count} (target 4)` });
  }
}

async function priceLabel(parking: ParkingRow): Promise<string> {
  const gr = parking.price_per_hour_gr ?? parking.price_per_event_gr ?? 0;
  return `${Math.round(gr / 100)} zł`;
}

/**
 * The pin for one specific parking. A PricePin names itself by what it is selling
 * ("12 zł, zadaszony"), which is both the accessible name a screen reader gets and
 * the only stable handle on a marker the map positions by transform.
 */
function pinFor(page: Page, label: string): Locator {
  return page.locator(`.maplibregl-marker button[aria-label^="${label}"]`);
}

test.describe("Ścieżka 1 — kupno miejsca", () => {
  test.beforeEach(async () => {
    await resetRateLimits();
  });

  test.afterAll(async () => {
    await cleanupE2eArtifacts();
  });

  test("z mapy do kodu QR, bez zakładania konta", async ({ page }, testInfo) => {
    const parking = await alwaysBookableParking();
    const secret = parking.access_instructions as string;
    const label = await priceLabel(parking);
    const expectedTotal = `${((parking.price_per_hour_gr as number) * HOURS_ON_CHECKOUT) / 100} zł`;
    const taps = new Taps();

    /* ---------------------------------------------------------------- the map */

    await page.goto("/");

    // The map IS the home screen: no marketing page stands between the driver and
    // the pin. If this never appears, MapLibre did not get a WebGL context.
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible();
    const pin = pinFor(page, label).first();
    await expect(pin, `no price pin showing ${label} — /api/map/parkings returned nothing`)
      .toBeVisible({ timeout: 20_000 });

    /* ------------------------------------------------------- 1. tap the pin */

    await taps.tap(`pinezka „${label}"`, pin);

    // Addressed by its accessible name, which is also the assertion: the sheet
    // used to borrow the filters sheet's heading through a duplicated DOM id and
    // announce every parking as "Filtry".
    const sheet = page.getByRole("dialog", { name: parking.title as string });
    await expect(sheet).toBeVisible();

    // The price on the card must be the price on the pin. A sheet quoting a
    // different number than the pin the driver just tapped is a trust bug — and a
    // raw price_per_*_gr payload produces exactly that. (<Price> typesets the
    // amount and the currency as separate spans, hence the tolerant regex.)
    const zloty = Math.round((parking.price_per_hour_gr as number) / 100);
    await expect(sheet).toContainText(new RegExp(`${zloty}\\s*zł`));

    // The sheet sells the spot. It must not give away the way in.
    await expect(
      sheet.getByText(secret),
      "access_instructions leaked into the map sheet, before any payment",
    ).toHaveCount(0);

    /* -------------------------------------------------- 2. tap "Zarezerwuj" */

    await taps.tap('„Zarezerwuj"', sheet.getByRole("button", { name: "Zarezerwuj" }));

    await page.waitForURL(/\/rezerwacja\/[0-9a-f-]{36}(\?|$)/);
    await expect(page.getByRole("heading", { name: "Rezerwacja" })).toBeVisible();

    await expect(
      page.getByText(secret),
      "access_instructions leaked into the checkout, before any payment",
    ).toHaveCount(0);

    /* ------------------------------------------------ 3-6. contact + consents */

    const email = e2eEmail("driver");

    await taps.type("pole e-mail", page.getByLabel("E-mail"), email);
    await taps.type("pole telefon", page.getByLabel("Telefon"), "601234567");
    await taps.tap("zgoda: regulamin", page.getByLabel(/Akceptuję regulamin/));
    await taps.tap("zgoda: dane osobowe", page.getByLabel(/przetwarzanie moich danych/));

    /* --------------------------------------------------------- 7. tap "Zapłać" */

    const pay = page.getByRole("button", { name: /^Zapłać/ });
    await expect(pay).toContainText(expectedTotal); // price computed server-side
    await taps.tap(`„Zapłać ${expectedTotal}"`, pay);

    /* ------------------------------------------------------------ the ticket */

    await page.waitForURL(/\/rezerwacja\/[0-9a-f-]{36}\/potwierdzenie/);
    await expect(page.getByRole("heading", { name: "Masz miejsce." })).toBeVisible({
      timeout: 30_000,
    });

    taps.report(testInfo);

    // The code, in the shape the gate expects.
    const ticket = await page.textContent("body");
    const code = ticket?.match(CODE_PATTERN)?.[0];
    expect(code, "no PK-XXXX-XXXX code on the confirmation screen").toBeTruthy();

    // The QR, addressed to that same code.
    await expect(page.getByRole("img", { name: `Kod QR rezerwacji ${code}` })).toBeVisible();

    // AND ONLY NOW the way in.
    await expect(
      page.getByText(secret),
      "access_instructions are missing from the ticket — the driver paid for nothing",
    ).toBeVisible();

    // The screen is not the evidence; the row is.
    const booking = await bookingByCode(code as string);
    expect(booking?.status).toBe("CONFIRMED");
    expect(booking?.price_gr).toBe((parking.price_per_hour_gr as number) * HOURS_ON_CHECKOUT);
    expect(booking?.parking_id).toBe(parking.id);
  });

  test("miejsca nie da się kupić za cenę przysłaną z frontu", async ({ page, request }) => {
    const parking = await alwaysBookableParking();
    const startsAt = new Date(Date.now() + 60 * 60_000);
    const endsAt = new Date(startsAt.getTime() + HOURS_ON_CHECKOUT * 60 * 60_000);

    // The contract has no `amount` field. Sending one anyway must change nothing —
    // this is the "ceny liczone wyłącznie na serwerze" rule, exercised rather than
    // asserted in a comment.
    const response = await request.post("/api/bookings", {
      data: {
        parkingId: parking.id,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        spots: 1,
        priceGr: 1,
        amount: 1,
        contact: { email: e2eEmail("cheapskate"), phone: "601234567" },
        consents: { terms: true, privacy: true },
      },
    });

    expect(response.ok()).toBeTruthy();
    const { bookingId, priceGr } = (await response.json()) as {
      bookingId: string;
      priceGr: number;
    };

    expect(priceGr).toBe((parking.price_per_hour_gr as number) * HOURS_ON_CHECKOUT);
    expect(priceGr).not.toBe(1);

    await page.request.post("/api/bookings/" + bookingId + "/cancel").catch(() => undefined);
  });
});
