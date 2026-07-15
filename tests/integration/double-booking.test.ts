import { describe, expect, it } from "vitest";
import { createBooking } from "@/modules/bookings/availability";
import { DomainError } from "@/modules/bookings/errors";
import {
  countBookingsFor,
  createDriver,
  createEvent,
  createHost,
  createParking,
  declareEventAvailability,
  futureWindow,
  occupiedSpots,
} from "./fixtures";
import { postBooking, type BookingRequestBody } from "./http";

/**
 * The test this project exists to pass.
 *
 * Two drivers stand at the same barrier at 19:52 and tap "Rezerwuję" in the same
 * second. One spot. If both get a booking, one of them drives to a car park that
 * is full, at night, in the rain, having paid — and no apology fixes that.
 *
 * The defence is a row lock (SELECT ... FOR UPDATE on the parking) inside the same
 * transaction that inserts the booking. This file is the only thing that proves it
 * works, and it can only prove it against a real PostgreSQL: a mocked database has
 * no lock manager, so a mocked version of this test would pass no matter what the
 * code did.
 *
 * Everything below runs the attempts through Promise.all on independent pooled
 * connections — genuinely concurrent transactions, not a loop pretending to be one.
 *
 * A race is non-deterministic: one green run proves nothing. Hence the rounds.
 */

const ROUNDS = 10;

function buyer(parkingId: string, email: string, window: { startsAt: Date; endsAt: Date }): BookingRequestBody {
  return {
    parkingId,
    startsAt: window.startsAt.toISOString(),
    endsAt: window.endsAt.toISOString(),
    spots: 1,
    contact: { email, phone: "+48601234567" },
    consents: { terms: true, privacy: true },
  };
}

describe("double booking: one spot, two buyers, same millisecond", () => {
  it(`gives the spot to exactly one of two concurrent buyers, ${ROUNDS} rounds running`, async () => {
    const host = await createHost();
    const [alice, bob] = await Promise.all([createDriver(), createDriver()]);
    const window = futureWindow();

    for (let round = 0; round < ROUNDS; round += 1) {
      const parking = await createParking({ ownerId: host.id, capacity: 1 });

      // Both transactions are in flight before either has committed. This is the
      // moment the FOR UPDATE lock exists for.
      const results = await Promise.allSettled([
        createBooking({ parkingId: parking.id, userId: alice.id, spots: 1, ...window }),
        createBooking({ parkingId: parking.id, userId: bob.id, spots: 1, ...window }),
      ]);

      const won = results.filter((result) => result.status === "fulfilled");
      const lost = results.filter((result) => result.status === "rejected");

      expect(won, `round ${round}: exactly one buyer must win`).toHaveLength(1);
      expect(lost, `round ${round}: the other must be told no`).toHaveLength(1);

      const rejection = (lost[0] as PromiseRejectedResult).reason;
      expect(rejection, `round ${round}`).toBeInstanceOf(DomainError);
      expect((rejection as DomainError).domainCode, `round ${round}`).toBe("SLOT_TAKEN");

      // The database, not the return values: one booking row, one spot held.
      expect(await countBookingsFor(parking.id), `round ${round}: rows in bookings`).toBe(1);
      expect(await occupiedSpots(parking.id), `round ${round}: spots held`).toBe(1);
    }
  });

  it(`answers 201 to one buyer and 409 SLOT_TAKEN to the other, ${ROUNDS} rounds running`, async () => {
    const host = await createHost();
    const window = futureWindow();

    for (let round = 0; round < ROUNDS; round += 1) {
      const parking = await createParking({ ownerId: host.id, capacity: 1 });

      // Through POST /api/bookings: Zod, rate limiter, session, service, error
      // mapping. 201 and 409 are what the driver's phone actually receives.
      const [first, second] = await Promise.all([
        postBooking(buyer(parking.id, `race-a-${round}@test.parkownia.local`, window)),
        postBooking(buyer(parking.id, `race-b-${round}@test.parkownia.local`, window)),
      ]);

      const statuses = [first.status, second.status].sort();
      expect(statuses, `round ${round}: one created, one refused`).toEqual([201, 409]);

      const refused = first.status === 409 ? first : second;
      expect(refused.body.error?.code, `round ${round}`).toBe("SLOT_TAKEN");

      const created = first.status === 201 ? first : second;
      expect(created.body.bookingId, `round ${round}`).toBeTruthy();

      expect(await occupiedSpots(parking.id), `round ${round}`).toBe(1);
    }
  });
});

describe("double booking: capacity is a ceiling, not a suggestion", () => {
  it("sells exactly 5 of 5 spots to ten concurrent buyers, and refuses the other five", async () => {
    const host = await createHost();
    const capacity = 5;
    const parking = await createParking({ ownerId: host.id, capacity });
    const window = futureWindow();

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        postBooking(buyer(parking.id, `crowd-${index}@test.parkownia.local`, window)),
      ),
    );

    const created = results.filter((result) => result.status === 201);
    const refused = results.filter((result) => result.status === 409);

    expect(created).toHaveLength(5);
    expect(refused).toHaveLength(5);
    expect(refused.every((result) => result.body.error?.code === "SLOT_TAKEN")).toBe(true);

    expect(await countBookingsFor(parking.id)).toBe(5);
    expect(await occupiedSpots(parking.id)).toBe(capacity);
  });

  it("respects the host's event declaration, not the size of their car park", async () => {
    const host = await createHost();
    // 50 spaces, but the host only released 3 for this match — the rest are for
    // the company's own cars. Selling the 4th is selling somebody's parking space
    // out from under them.
    const parking = await createParking({ ownerId: host.id, capacity: 50 });
    const event = await createEvent();
    await declareEventAvailability({ eventId: event.id, parkingId: parking.id, spots: 3 });

    const results = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        postBooking({
          parkingId: parking.id,
          eventId: event.id,
          spots: 1,
          contact: { email: `lech-${index}@test.parkownia.local`, phone: "+48601234567" },
          consents: { terms: true, privacy: true },
        }),
      ),
    );

    expect(results.filter((result) => result.status === 201)).toHaveLength(3);
    expect(results.filter((result) => result.status === 409)).toHaveLength(3);
    expect(await occupiedSpots(parking.id)).toBe(3);
  });

  it("counts spots, not bookings: five buyers wanting two spots each on a five-spot lot", async () => {
    const host = await createHost();
    const parking = await createParking({ ownerId: host.id, capacity: 5 });
    const window = futureWindow();

    const results = await Promise.all(
      Array.from({ length: 5 }, (_, index) => {
        const request = buyer(parking.id, `pairs-${index}@test.parkownia.local`, window);
        return postBooking({ ...request, spots: 2 });
      }),
    );

    // Two buyers fit (4 spots). The fifth spot cannot be sold to someone who needs
    // two — and "one spot left" must not be rounded up into a sale.
    expect(results.filter((result) => result.status === 201)).toHaveLength(2);
    expect(results.filter((result) => result.status === 409)).toHaveLength(3);
    expect(await occupiedSpots(parking.id)).toBe(4);
  });
});
