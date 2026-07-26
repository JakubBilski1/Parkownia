import { expect, test } from "@playwright/test";
import { e2eEmail, loginAs, logout, waitForRow } from "./fixtures/app";
import {
  ACCOUNTS,
  cleanupE2eArtifacts,
  resetRateLimits,
  sql,
  SEED_PASSWORD,
} from "./fixtures/db";

/**
 * The supply side, end to end: a client gets an account, lists a parking, and a
 * driver can buy it.
 *
 *   admin zakłada konto → zostań hostem → 5 pól → AUTOSAVE → odświeżenie strony
 *              → wysłanie do moderacji → admin zatwierdza → pinezka na mapie
 *
 * Phase 1 changed when self-service sign-up was switched off: the account now
 * comes from an admin, and the test asserts that an anonymous attempt is refused.
 *
 * The autosave reload is the point of this file. DESIGN_PRINCIPLES §6.3:
 * "Dodawanie parkingu ma 20 pól — jeśli użytkownik zamknie kartę, ma wrócić do
 * tego samego miejsca." A form that loses twenty fields to a stray tab close
 * loses the host with them, and nobody types that twice.
 */

type NewParking = {
  title: string;
  capacity: string;
  priceEvent: string;
};

test.describe("Cykl życia parkingu — od konta do pinezki", () => {
  /**
   * The longest test in the suite, and the only one that earns extra time.
   *
   * It drives six phases end to end — register, create, autosave across a reload,
   * submit, moderate, appear on the map — and each is a first hit on a route that
   * `next dev` compiles on demand. On an unloaded machine it lands around 70 s
   * against the suite's 90 s default, i.e. under 25% headroom, and it fails
   * whenever anything else is competing for the CPU. It has been observed failing
   * on unrelated code for exactly this reason.
   *
   * Raising the ceiling here does not hide a slow product: `next build` is not on
   * this path, and the same journey takes seconds against a compiled server. It
   * buys the room this specific test always needed. Every other test keeps the
   * 90 s default, so a genuine regression elsewhere still fails loudly.
   */
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async () => {
    await resetRateLimits();
  });

  test.afterAll(async () => {
    await cleanupE2eArtifacts();
  });

  test("konto od admina → parking → autosave przeżywa odświeżenie → moderacja → mapa", async ({
    page,
  }) => {
    const email = e2eEmail("host");
    const parking: NewParking = {
      // The E2E prefix is what lets cleanup find this row later.
      title: `E2E Podwórko ${Date.now()}`,
      capacity: "6",
      priceEvent: "25",
    };

    /* ------------------------------------------- 1. konto zakłada administrator */

    // Self-service registration is off: /rejestracja no longer exists and
    // POST /api/auth/register answers 403 to anybody who is not an admin. That
    // rule is worth asserting, not just working around — a regression here would
    // reopen public sign-up silently.
    const anonymous = await page.request.post("/api/auth/register", {
      data: {
        email: e2eEmail("intruz"),
        password: SEED_PASSWORD,
        consents: { terms: true, privacy: true },
      },
    });
    expect(
      [401, 403],
      `public registration answered ${anonymous.status()} — it must be closed`,
    ).toContain(anonymous.status());

    await loginAs(page, ACCOUNTS.admin);

    const createdByAdmin = await page.request.post("/api/auth/register", {
      data: {
        email,
        password: SEED_PASSWORD,
        consents: { terms: true, privacy: true },
      },
    });
    expect(
      createdByAdmin.ok(),
      `admin could not create an account: ${createdByAdmin.status()} ${await createdByAdmin.text()}`,
    ).toBeTruthy();

    // The admin stays the admin: creating an account must not swap the session
    // for the new one. Then we become the new host for the rest of the journey.
    await logout(page);
    await loginAs(page, email);

    /* --------------------------------------------------------- 2. zostań hostem */

    await page.goto("/zostan-hostem");
    await page.getByRole("button", { name: "Zacznij wynajmować" }).click();

    // The role has to actually land, or /panel/parkingi/nowy bounces us straight out.
    await waitForRow(
      async () => {
        const [row] = await sql<{ roles: string[] }[]>`
          select array_agg(r.role) as roles
          from users u join user_roles r on r.user_id = u.id
          where u.email = ${email} group by u.id`;
        return row;
      },
      (row) => row.roles.includes("HOST_INDIVIDUAL"),
      { what: "the HOST_INDIVIDUAL role" },
    );

    /* ------------------------------------------------- 3. the five required fields */

    await page.goto("/panel/parkingi/nowy");
    await expect(page.getByRole("heading", { name: "Dodaj parking" })).toBeVisible();

    await page.getByLabel("Nazwa parkingu").fill(parking.title);
    await page.getByLabel("Liczba miejsc").fill(parking.capacity);
    await page.getByLabel("Za wydarzenie").fill(parking.priceEvent);

    // The location comes from a tap on the map, like a host's would. The canvas is
    // MapLibre's, so this also proves WebGL is alive on the host side of the app.
    const canvas = page.locator("canvas.maplibregl-canvas").first();
    await expect(canvas).toBeVisible();
    await canvas.click({ position: { x: 160, y: 110 } });

    /* --------------------------------------- 4. autosave, then pull the rug out */

    // Debounced 1.2 s. We wait for the app to SAY it saved rather than sleeping.
    await expect(page.getByText(/Szkic zapisany o/)).toBeVisible({ timeout: 20_000 });

    const draft = await waitForRow(
      async () => {
        const [row] = await sql<{ id: string; status: string; title: string | null }[]>`
          select p.id, p.status, p.title from parkings p
          join users u on u.id = p.owner_id
          where u.email = ${email}`;
        return row;
      },
      (row) => row.status === "DRAFT",
      { what: "a DRAFT parking row" },
    );

    expect(draft.title).toBe(parking.title);

    // The host closes the tab / the phone kills the tab / a call comes in.
    await page.reload();

    // Everything typed is still there. This is the assertion the whole file exists for.
    await expect(page.getByLabel("Nazwa parkingu")).toHaveValue(parking.title);
    await expect(page.getByLabel("Liczba miejsc")).toHaveValue(parking.capacity);
    await expect(page.getByLabel("Za wydarzenie")).toHaveValue(parking.priceEvent);

    // …including the pin, which is the one field a host cannot retype from memory.
    const stillPlaced = await sql<{ has_location: boolean }[]>`
      select location is not null as has_location from parkings where id = ${draft.id}`;
    expect(stillPlaced[0]?.has_location, "the map pin did not survive the reload").toBe(true);

    /* -------------------------------------------------- 5. wyślij do sprawdzenia */

    await page.getByRole("button", { name: "Wyślij do sprawdzenia" }).click();

    await waitForRow(
      async () => {
        const [row] = await sql<{ status: string }[]>`
          select status from parkings where id = ${draft.id}`;
        return row;
      },
      (row) => row.status === "PENDING_REVIEW",
      { what: "PENDING_REVIEW after submit" },
    );

    // Not for sale yet: moderation is a gate, not a formality.
    const beforeReview = await page.request.get(
      "/api/map/parkings?bbox=16.80,52.35,16.95,52.45",
    );
    const pinsBefore = (await beforeReview.json()) as { items: Array<{ id: string }> };
    expect(
      pinsBefore.items.some((pin) => pin.id === draft.id),
      "a PENDING_REVIEW parking is on the map — it is being sold before anyone looked at it",
    ).toBe(false);

    /* ----------------------------------------------------- 6. admin zatwierdza */

    await loginAs(page, ACCOUNTS.admin);
    await page.goto("/admin/moderacja");

    const card = page
      .locator("li")
      .filter({ hasText: parking.title })
      .filter({ has: page.getByRole("button", { name: "Zatwierdź" }) })
      .last();

    await expect(card, "the parking never reached the moderation queue").toBeVisible({
      timeout: 20_000,
    });
    await card.getByRole("button", { name: "Zatwierdź" }).click();

    await waitForRow(
      async () => {
        const [row] = await sql<{ status: string }[]>`
          select status from parkings where id = ${draft.id}`;
        return row;
      },
      (row) => row.status === "ACTIVE",
      { what: "ACTIVE after the admin approved" },
    );

    /* --------------------------------------------------------- 7. na sprzedaży */

    const afterReview = await page.request.get(
      "/api/map/parkings?bbox=16.80,52.35,16.95,52.45",
    );
    const pinsAfter = (await afterReview.json()) as {
      items: Array<{ id: string; priceGr: number }>;
    };

    const pin = pinsAfter.items.find((item) => item.id === draft.id);
    expect(pin, "an approved parking is not on the map — the host will never be paid").toBeTruthy();
    // Grosze, integer, straight from the "25" the host typed in złoty.
    expect(pin?.priceGr).toBe(2500);
  });
});
