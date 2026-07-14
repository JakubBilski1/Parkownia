import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { createBooking, PENDING_TTL_MINUTES } from "@/modules/bookings/availability";
import { DomainError } from "@/modules/bookings/errors";
import { expirePendingBookings } from "@/modules/bookings/expire";
import {
  createDriver,
  createHost,
  createParking,
  expirePendingHold,
  futureWindow,
  getBooking,
  occupiedSpots,
} from "./fixtures";

/**
 * A PENDING booking is an unpaid hold. It has to do two opposite things well:
 *
 *   while it lives — block the spot completely. Someone is in the payment sheet
 *   with their bank app open; selling the spot out from under them is how a
 *   driver pays for a place that no longer exists.
 *
 *   once it lapses — release the spot instantly. An abandoned checkout must not
 *   hold the last space at kick-off, and it must not need a cron job to have run
 *   for the next buyer to get in.
 *
 * The release is lazy, in the occupancy query (`pending_expires_at > now()`), and
 * the cron only makes the status column agree with what the query already knows.
 * That ordering matters: it means the spot is free the moment the TTL passes, not
 * the moment a job next runs.
 */

describe("PENDING hold: 15 minutes, then the spot is somebody else's", () => {
  it("blocks the spot while the hold is alive", async () => {
    const host = await createHost();
    const [alice, bob] = await Promise.all([createDriver(), createDriver()]);
    const parking = await createParking({ ownerId: host.id, capacity: 1 });
    const window = futureWindow();

    const { booking } = await createBooking({
      parkingId: parking.id,
      userId: alice.id,
      spots: 1,
      ...window,
    });

    expect(booking.status).toBe("PENDING");
    expect(booking.pendingExpiresAt).not.toBeNull();

    // The TTL is the contract the checkout screen counts down to (docs/PAYMENTS.md §2.1).
    const ttlMinutes =
      (booking.pendingExpiresAt!.getTime() - booking.createdAt.getTime()) / 60_000;
    expect(ttlMinutes).toBeCloseTo(PENDING_TTL_MINUTES, 0);

    // Alice has not paid. Bob still cannot have the spot.
    await expect(
      createBooking({ parkingId: parking.id, userId: bob.id, spots: 1, ...window }),
    ).rejects.toThrow(DomainError);

    expect(await occupiedSpots(parking.id)).toBe(1);
  });

  it("releases the spot the moment the hold lapses — no cron required", async () => {
    const host = await createHost();
    const [alice, bob] = await Promise.all([createDriver(), createDriver()]);
    const parking = await createParking({ ownerId: host.id, capacity: 1 });
    const window = futureWindow();

    const { booking: abandoned } = await createBooking({
      parkingId: parking.id,
      userId: alice.id,
      spots: 1,
      ...window,
    });

    await expirePendingHold(abandoned.id);

    // Nothing has run. The status column still says PENDING — and the spot is
    // nonetheless free, because occupancy is decided against now().
    expect((await getBooking(abandoned.id)).status).toBe("PENDING");
    expect(await occupiedSpots(parking.id)).toBe(0);

    const { booking: bobsBooking } = await createBooking({
      parkingId: parking.id,
      userId: bob.id,
      spots: 1,
      ...window,
    });

    expect(bobsBooking.status).toBe("PENDING");
    expect(await occupiedSpots(parking.id)).toBe(1);
  });

  it("cron makes the status column tell the truth, and touches nothing else", async () => {
    const host = await createHost();
    const [alice, bob] = await Promise.all([createDriver(), createDriver()]);
    const parking = await createParking({ ownerId: host.id, capacity: 2 });
    const window = futureWindow();

    const { booking: lapsed } = await createBooking({
      parkingId: parking.id,
      userId: alice.id,
      spots: 1,
      ...window,
    });
    const { booking: alive } = await createBooking({
      parkingId: parking.id,
      userId: bob.id,
      spots: 1,
      ...window,
    });

    await expirePendingHold(lapsed.id);

    const result = await expirePendingBookings();
    expect(result.expired).toBeGreaterThanOrEqual(1);

    const lapsedAfter = await getBooking(lapsed.id);
    expect(lapsedAfter.status).toBe("EXPIRED");
    expect(lapsedAfter.pendingExpiresAt).toBeNull();

    // A live hold is not swept up with the dead ones.
    const aliveAfter = await getBooking(alive.id);
    expect(aliveAfter.status).toBe("PENDING");
    expect(aliveAfter.pendingExpiresAt).not.toBeNull();

    expect(await occupiedSpots(parking.id)).toBe(1);
  });

  it("never expires a hold whose payment already succeeded", async () => {
    const host = await createHost();
    const driver = await createDriver();
    const parking = await createParking({ ownerId: host.id, capacity: 1 });

    const { booking } = await createBooking({
      parkingId: parking.id,
      userId: driver.id,
      spots: 1,
      ...futureWindow(),
    });

    // The money landed; the webhook that confirms it has not been processed yet.
    // This is the exact window in which the cron could destroy a paid booking.
    await db.insert(payments).values({
      bookingId: booking.id,
      provider: "MANUAL",
      providerRef: "mock_pi_paid",
      amountGr: booking.priceGr,
      status: "SUCCEEDED",
    });

    await expirePendingHold(booking.id);
    await expirePendingBookings();

    // Still PENDING: this row belongs to confirmPaidBooking(), which re-checks the
    // spot under lock and refunds if it is gone. Expiring it here would strand the
    // driver's money with no booking and no refund.
    expect((await getBooking(booking.id)).status).toBe("PENDING");

    await db.delete(payments).where(eq(payments.bookingId, booking.id));
  });

  it("an expired hold frees capacity for the exact number of spots it held", async () => {
    const host = await createHost();
    const [alice, bob] = await Promise.all([createDriver(), createDriver()]);
    const parking = await createParking({ ownerId: host.id, capacity: 3 });
    const window = futureWindow();

    const { booking } = await createBooking({
      parkingId: parking.id,
      userId: alice.id,
      spots: 3,
      ...window,
    });
    expect(await occupiedSpots(parking.id)).toBe(3);

    await expect(
      createBooking({ parkingId: parking.id, userId: bob.id, spots: 1, ...window }),
    ).rejects.toMatchObject({ domainCode: "SLOT_TAKEN" });

    await expirePendingHold(booking.id);

    const { booking: bobs } = await createBooking({
      parkingId: parking.id,
      userId: bob.id,
      spots: 3,
      ...window,
    });

    expect(bobs.spots).toBe(3);
    expect(await occupiedSpots(parking.id)).toBe(3);

    // And the lot is full again.
    await expect(
      createBooking({ parkingId: parking.id, userId: alice.id, spots: 1, ...window }),
    ).rejects.toMatchObject({ domainCode: "SLOT_TAKEN" });
  });
});
