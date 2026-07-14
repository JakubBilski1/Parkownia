import { expect, test } from "@playwright/test";
import { e2eEmail, loginAs, waitForRow } from "./fixtures/app";
import {
  ACCOUNTS,
  cleanupE2eArtifacts,
  resetRateLimits,
  sql,
  SEED_PASSWORD,
} from "./fixtures/db";

/**
 * The supply side, end to end: a stranger becomes a host, lists a parking, and
 * a driver can buy it.
 *
 *   rejestracja → zostań hostem → 5 pól → AUTOSAVE → odświeżenie strony
 *              → wysłanie do moderacji → admin zatwierdza → pinezka na mapie
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

test.describe("Cykl życia parkingu — od rejestracji do pinezki", () => {
  test.beforeEach(async () => {
    await resetRateLimits();
  });

  test.afterAll(async () => {
    await cleanupE2eArtifacts();
  });

  test("rejestracja → parking → autosave przeżywa odświeżenie → moderacja → mapa", async ({
    page,
  }) => {
    const email = e2eEmail("host");
    const parking: NewParking = {
      // The E2E prefix is what lets cleanup find this row later.
      title: `E2E Podwórko ${Date.now()}`,
      capacity: "6",
      priceEvent: "25",
    };

    /* ------------------------------------------------------------ 1. rejestracja */

    await page.goto("/rejestracja");

    // Anchored: a plain "E-mail" also matches the marketing checkbox ("Chcę
    // dostawać e-maile…"), and an exact match misses the required marker that
    // Field renders inside the <label>.
    await page.getByLabel(/^E-mail/).fill(email);
    await page.getByLabel(/^Hasło/).fill(SEED_PASSWORD);
    await page.getByLabel(/Akceptuję/).check();
    await page.getByLabel(/przetwarzanie moich danych/).check();
    await page.getByRole("button", { name: "Załóż konto" }).click();

    await expect(page).not.toHaveURL(/rejestracja/, { timeout: 20_000 });

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
