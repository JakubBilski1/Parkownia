import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  availabilityRow,
  cleanupE2eArtifacts,
  createLiveEvent,
  eventPricedParkingOf,
  issueQuickDeclareToken,
  resetRateLimits,
  sql,
  userIdByEmail,
} from "./fixtures/db";

/**
 * CRITICAL PATH 3 (docs/DESIGN_PRINCIPLES.md §7) — the host at home, in the evening.
 *
 * "Musi być jednym kliknięciem z maila. Link z maila → strona z jednym pytaniem
 *  → dwa przyciski. Każde dodatkowe pole to spadek konwersji podaży."
 *
 * So the test is as much about what is ABSENT as what is present: no login wall,
 * no form, no third option. And the declaration has to actually land in
 * event_parking_availability — a screen that says "Udostępnione" while writing
 * nothing is the worst of both worlds.
 */

const SPOTS = 8;
const PRICE_GR = 3000;

test.describe("Ścieżka 3 — udostępnienie parkingu jednym kliknięciem", () => {
  test.beforeEach(async () => {
    await resetRateLimits();
  });

  test.afterAll(async () => {
    await cleanupE2eArtifacts();
  });

  test("„Tak” z maila zapisuje deklarację — bez logowania", async ({ page, context }) => {
    const hostId = await userIdByEmail(ACCOUNTS.host);
    const parking = await eventPricedParkingOf(ACCOUNTS.host);
    const event = await createLiveEvent(`E2E Deklaracja ${Date.now()}`);

    const token = await issueQuickDeclareToken({
      userId: hostId,
      eventId: event.id,
      parkingId: parking.id,
      spots: SPOTS,
      priceGr: PRICE_GR,
    });

    // The host clicks a link in a mail client. There is no session anywhere.
    await context.clearCookies();
    await page.goto(`/udostepnij/${token}`);

    /* ------------------------------------------------- one question, two buttons */

    await expect(
      page.getByRole("heading", { name: new RegExp(`Udostępniasz parking na ${event.title}`) }),
    ).toBeVisible();

    const yes = page.getByRole("button", { name: `Tak, ${SPOTS} miejsc po 30 zł` });
    const no = page.getByRole("button", { name: "Nie tym razem" });

    await expect(yes).toBeVisible();
    await expect(no).toBeVisible();

    // Two buttons and no third way. A form here would cost supply.
    await expect(page.locator("main button")).toHaveCount(2);
    await expect(page.locator("main input, main select, main textarea")).toHaveCount(0);

    // Not behind a login wall: the URL is still the token's, not /logowanie.
    expect(page.url()).toContain(`/udostepnij/${token}`);

    /* --------------------------------------------------------------- one click */

    await yes.click();

    await expect(page.getByRole("heading", { name: "Udostępnione" })).toBeVisible();

    /* ---------------------------------------------- the row, not just the screen */

    const declared = await availabilityRow(event.id, parking.id);
    expect(declared, "no row in event_parking_availability — the screen lied").toBeTruthy();
    expect(declared?.is_available).toBe(true);
    expect(declared?.spots).toBe(SPOTS);
    // Spots and price come from the token, never from the client.
    expect(declared?.price_gr).toBe(PRICE_GR);

    /* --------------------------------------------- the link is spent, exactly once */

    const [tokenRow] = await sql<{ used_at: Date | null }[]>`
      select used_at from action_tokens where user_id = ${hostId}
      order by created_at desc limit 1`;
    expect(tokenRow?.used_at, "the action token was not burned").toBeTruthy();

    // A second visit must not offer the button again — a mail client that prefetches
    // links, or a host who taps twice, must not be able to re-declare.
    await page.goto(`/udostepnij/${token}`);
    await expect(page.getByRole("heading", { name: "Ten link został już użyty" })).toBeVisible();
  });

  test("„Nie tym razem” zapisuje odmowę, nie ciszę", async ({ page, context }) => {
    const hostId = await userIdByEmail(ACCOUNTS.host);
    const parking = await eventPricedParkingOf(ACCOUNTS.host);
    const event = await createLiveEvent(`E2E Odmowa ${Date.now()}`);

    const token = await issueQuickDeclareToken({
      userId: hostId,
      eventId: event.id,
      parkingId: parking.id,
      spots: SPOTS,
      priceGr: PRICE_GR,
    });

    await context.clearCookies();
    await page.goto(`/udostepnij/${token}`);

    await page.getByRole("button", { name: "Nie tym razem" }).click();
    await expect(page.getByRole("heading", { name: "Zapisane" })).toBeVisible();

    // "No" is a decision and is stored as one: it is what stops us mailing the host
    // about this event again.
    const declined = await availabilityRow(event.id, parking.id);
    expect(declined).toBeTruthy();
    expect(declined?.is_available).toBe(false);
  });

  test("zmyślony token niczego nie zapisuje", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/udostepnij/nie-ma-takiego-tokena");

    await expect(page.getByRole("heading", { name: "Ten link nie działa" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Tak/ })).toHaveCount(0);
  });
});
