import { describe, expect, it } from "vitest";
import { createDriver } from "./fixtures";
import { getMe, patchMe, sessionCookie } from "./http";

/**
 * RODO art. 16 — rectification, end to end against the real database.
 *
 * The reason this endpoint exists is one line in modules/bookings/service.ts:
 * checkout writes `COALESCE(users.phone, EXCLUDED.phone)`, so the first number a
 * person ever gives us is the one we keep. Right — a purchase must not silently
 * rewrite an account — but it means a typo made once is permanent unless there
 * is another door. This suite is that door, and it also guards the two ways this
 * kind of endpoint usually goes wrong: wiping fields nobody sent, and letting an
 * identity column through with the harmless ones.
 */
describe("PATCH /api/me", () => {
  it("replaces a phone number that checkout would have refused to overwrite", async () => {
    const driver = await createDriver();
    const cookies = await sessionCookie(driver.id);

    const response = await patchMe({ phone: "602 999 111" }, { cookies });

    expect(response.status).toBe(200);
    // Normalised on the way in — what comes back is what a gateway would dial.
    expect(response.body.phone).toBe("+48602999111");

    const after = await getMe({ cookies });
    expect(after.body.phone).toBe("+48602999111");
  });

  it("leaves out of the update every field the client did not send", async () => {
    const driver = await createDriver();
    const cookies = await sessionCookie(driver.id);

    await patchMe({ firstName: "Jan", lastName: "Kowalski" }, { cookies });
    const response = await patchMe({ phone: "602 999 112" }, { cookies });

    expect(response.status).toBe(200);
    expect(response.body.firstName).toBe("Jan");
    expect(response.body.lastName).toBe("Kowalski");
    expect(response.body.phone).toBe("+48602999112");
  });

  it("clears a field on an explicit null — holding data nobody asked us to hold", async () => {
    const driver = await createDriver();
    const cookies = await sessionCookie(driver.id);

    const response = await patchMe({ phone: null }, { cookies });

    expect(response.status).toBe(200);
    expect(response.body.phone).toBeNull();
    expect((await getMe({ cookies })).body.phone).toBeNull();
  });

  it("ignores an e-mail smuggled in beside a name — the login is not editable here", async () => {
    const driver = await createDriver();
    const cookies = await sessionCookie(driver.id);

    const response = await patchMe(
      { firstName: "Jan", email: "przejety@example.com" },
      { cookies },
    );

    expect(response.status).toBe(200);
    expect(response.body.email).toBe(driver.email);
    expect((await getMe({ cookies })).body.email).toBe(driver.email);
  });

  it("turns down a number that could never receive an SMS, and changes nothing", async () => {
    const driver = await createDriver();
    const cookies = await sessionCookie(driver.id);

    const response = await patchMe({ phone: "12345" }, { cookies });

    expect(response.status).toBe(400);
    expect((await getMe({ cookies })).body.phone).toBe(driver.phone);
  });

  it("turns down an empty patch instead of touching the row", async () => {
    const driver = await createDriver();
    const cookies = await sessionCookie(driver.id);

    expect((await patchMe({}, { cookies })).status).toBe(400);
  });

  it("answers 401 without a session — this is somebody's personal data", async () => {
    const response = await patchMe({ firstName: "Jan" });

    expect(response.status).toBe(401);
  });
});
