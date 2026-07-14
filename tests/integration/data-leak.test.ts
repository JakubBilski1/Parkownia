import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createBooking } from "@/modules/bookings/availability";
import {
  createDriver,
  createHost,
  createParking,
  futureWindow,
  getBooking,
} from "./fixtures";
import {
  getBookingDetail,
  getParking,
  postPaymentIntent,
  postWebhook,
  sessionCookie,
} from "./http";

/**
 * Two secrets live on a parking, and neither may ever leave the server to the
 * wrong person:
 *
 *   access_instructions — the code to the barrier. Whoever has it parks for free,
 *     forever, without booking anything. It is released only once a booking is
 *     paid for (docs/DATA_MODEL.md §3, docs/API_SPEC.md §3).
 *
 *   payout_bank_account — the host's IBAN. It is nobody's business but ours and
 *     theirs, and it is not a field any client of this API has ever needed.
 *
 * These assertions do not check that a key is absent from a DTO. They check that
 * the secret's *value* appears nowhere in the bytes on the wire — a rename, a
 * spread of the whole row, a nested object, a debug field: all of them fail here.
 */

const BARRIER_CODE = "Kod do szlabanu: 4417#, potem w prawo pod wiatę.";
const HOST_IBAN = "PL61109010140000071219812874";

async function parkingWithSecrets() {
  const host = await createHost();
  const parking = await createParking({
    ownerId: host.id,
    capacity: 1,
    accessInstructions: BARRIER_CODE,
    payoutBankAccount: HOST_IBAN,
  });
  return { host, parking };
}

describe("GET /api/parkings/:id — the public parking page", () => {
  it("never carries the barrier code or the host's bank account to an anonymous visitor", async () => {
    const { parking } = await parkingWithSecrets();

    const response = await getParking(parking.id);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(parking.id);
    // It is a real, populated response — not an empty object that trivially
    // contains no secrets.
    expect(response.body.title).toBeTruthy();
    expect(response.body.capacity).toBe(1);

    expect(response.body).not.toHaveProperty("accessInstructions");
    expect(response.body).not.toHaveProperty("payoutBankAccount");

    // The bytes, not the shape.
    expect(response.raw).not.toContain("4417");
    expect(response.raw).not.toContain(HOST_IBAN);
    expect(response.raw.toLowerCase()).not.toContain("szlaban");
  });

  it("does not leak them to a logged-in driver either — paying is what unlocks the code", async () => {
    const { parking } = await parkingWithSecrets();
    const driver = await createDriver();

    const response = await getParking(parking.id, {
      cookies: await sessionCookie(driver.id),
    });

    expect(response.status).toBe(200);
    expect(response.raw).not.toContain("4417");
    expect(response.raw).not.toContain(HOST_IBAN);
  });
});

describe("GET /api/bookings/:id — the code appears when the money does", () => {
  it("withholds the barrier code, the booking code and the QR while the booking is PENDING", async () => {
    const { parking } = await parkingWithSecrets();
    const driver = await createDriver();

    const { booking } = await createBooking({
      parkingId: parking.id,
      userId: driver.id,
      spots: 1,
      ...futureWindow(),
    });

    const response = await getBookingDetail(booking.id, {
      cookies: await sessionCookie(driver.id),
    });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("PENDING");

    // Not paid yet. A PENDING booking that handed out the barrier code would be a
    // free parking space for anyone who can open a checkout screen and walk away.
    expect(response.body.accessInstructions).toBeNull();
    expect(response.body.code).toBeNull();
    expect(response.body.qrDataUrl).toBeNull();
    expect(response.body.entranceLocation).toBeNull();

    expect(response.raw).not.toContain("4417");
    expect(response.raw).not.toContain(booking.code);
  });

  it("releases the barrier code, the booking code and the QR once the booking is CONFIRMED", async () => {
    const { parking } = await parkingWithSecrets();
    const driver = await createDriver();
    const cookies = await sessionCookie(driver.id);

    const { booking } = await createBooking({
      parkingId: parking.id,
      userId: driver.id,
      spots: 1,
      ...futureWindow(),
    });

    const intent = await postPaymentIntent({ bookingId: booking.id, method: "BLIK" }, { cookies });
    const webhook = await postWebhook({
      id: `itest_evt_${randomUUID()}`,
      type: "PAYMENT_SUCCEEDED",
      providerRef: intent.body.providerRef,
    });
    expect(webhook.body.outcome).toBe("CONFIRMED");

    const response = await getBookingDetail(booking.id, { cookies });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("CONFIRMED");

    // Paid. Now the driver gets what they bought.
    expect(response.body.accessInstructions).toBe(BARRIER_CODE);
    expect(response.body.code).toBe((await getBooking(booking.id)).code);
    expect(response.body.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    // Navigation goes to the entrance, not to the middle of the car park.
    expect(response.body.entranceLocation).toEqual({
      lat: expect.any(Number),
      lng: expect.any(Number),
    });

    // The host's bank account is still none of the driver's business.
    expect(response.raw).not.toContain(HOST_IBAN);
  });

  it("refuses a booking that is not yours, paid or not", async () => {
    const { parking } = await parkingWithSecrets();
    const [driver, stranger] = await Promise.all([createDriver(), createDriver()]);
    const cookies = await sessionCookie(driver.id);

    const { booking } = await createBooking({
      parkingId: parking.id,
      userId: driver.id,
      spots: 1,
      ...futureWindow(),
    });

    const intent = await postPaymentIntent({ bookingId: booking.id, method: "BLIK" }, { cookies });
    await postWebhook({
      id: `itest_evt_${randomUUID()}`,
      type: "PAYMENT_SUCCEEDED",
      providerRef: intent.body.providerRef,
    });

    // Booking ids are UUIDv4 and unguessable — but "unguessable" is not an access
    // control, and this is.
    const asStranger = await getBookingDetail(booking.id, {
      cookies: await sessionCookie(stranger.id),
    });
    expect(asStranger.status).toBe(403);
    expect(asStranger.raw).not.toContain("4417");

    const asNobody = await getBookingDetail(booking.id);
    expect(asNobody.status).toBe(403);
    expect(asNobody.raw).not.toContain("4417");
  });
});
