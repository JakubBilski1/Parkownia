import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBooking } from "@/modules/bookings/availability";
import { cancelBooking } from "@/modules/bookings/cancel";
import { setEmailProvider } from "@/modules/notifications/email";
import type { EmailMessage, EmailProvider, SendResult } from "@/modules/notifications/provider";
import { applySucceededPayment } from "@/modules/payments/service";
import {
  createDriver,
  createHost,
  createParking,
  expirePendingHold,
  findPayment,
  futureWindow,
  getBooking,
  notificationsFor,
  occupiedSpots,
  waitFor,
} from "./fixtures";
import { postPaymentIntent, postWebhook, sessionCookie } from "./http";

/**
 * docs/PAYMENTS.md §3.2, the row that reads:
 *
 *   "PENDING wygasł przed webhookiem `succeeded` (płatność w ostatniej sekundzie)"
 *
 * The driver authorised BLIK at the 899th second. The hold died at the 900th. The
 * money is ours and the spot may or may not still be there. Two outcomes, and both
 * of them have to be right, because this is the scenario where it is easiest to
 * quietly keep somebody else's money:
 *
 *   spot still free → CONFIRMED. Late, but honoured. The driver paid; they park.
 *   spot gone       → full refund, immediately, and we say so. Never a charge
 *                     without a booking.
 *
 * A mocked database cannot test this: the re-check happens under the same row lock
 * the purchase used, against now().
 */

class RecordingEmailProvider implements EmailProvider {
  readonly name = "recording";
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<SendResult> {
    this.sent.push(message);
    return { ok: true };
  }
}

let mailbox: RecordingEmailProvider;

beforeEach(() => {
  mailbox = new RecordingEmailProvider();
  setEmailProvider(mailbox);
});

afterEach(() => {
  setEmailProvider(undefined);
});

async function heldBooking(parkingId: string, userId: string) {
  const { booking } = await createBooking({
    parkingId,
    userId,
    spots: 1,
    ...futureWindow(),
  });

  const cookies = await sessionCookie(userId);
  const intent = await postPaymentIntent({ bookingId: booking.id, method: "BLIK" }, { cookies });
  expect(intent.status).toBe(200);

  return { booking, providerRef: intent.body.providerRef };
}

describe("late webhook: the money arrived after the hold died", () => {
  it("honours the booking when the spot is still free", async () => {
    const host = await createHost();
    const driver = await createDriver();
    const parking = await createParking({ ownerId: host.id, capacity: 1 });

    const { booking, providerRef } = await heldBooking(parking.id, driver.id);

    // 15 minutes pass. Nobody else took the spot.
    await expirePendingHold(booking.id);
    expect(await occupiedSpots(parking.id)).toBe(0);

    const response = await postWebhook({
      id: `itest_evt_${randomUUID()}`,
      type: "PAYMENT_SUCCEEDED",
      providerRef,
    });

    expect(response.status).toBe(200);
    expect(response.body.outcome).toBe("CONFIRMED");

    const confirmed = await getBooking(booking.id);
    expect(confirmed.status).toBe("CONFIRMED");
    expect(confirmed.pendingExpiresAt).toBeNull();
    // Not refunded. The driver paid, the spot was there, they park.
    expect(confirmed.refundGr).toBeNull();

    const payment = await findPayment(booking.id);
    expect(payment?.status).toBe("SUCCEEDED");
    expect(payment?.refundedGr).toBe(0);

    expect(await occupiedSpots(parking.id)).toBe(1);

    await waitFor(async () => mailbox.sent.length === 1);
    const mail = mailbox.sent[0]!;
    expect(mail.template).toBe("booking-confirmed");
    expect(mail.data.code).toBe(confirmed.code);
  });

  it("refunds in full when the spot went to somebody else", async () => {
    const host = await createHost();
    const [late, winner] = await Promise.all([createDriver(), createDriver()]);
    const parking = await createParking({ ownerId: host.id, capacity: 1 });

    // The slow driver takes a hold and starts paying.
    const { booking: lateBooking, providerRef } = await heldBooking(parking.id, late.id);

    // Their 15 minutes run out.
    await expirePendingHold(lateBooking.id);

    // The spot is free again, and somebody else buys it and pays for it.
    const { booking: winnerBooking, providerRef: winnerRef } = await heldBooking(
      parking.id,
      winner.id,
    );
    const winnerWebhook = await postWebhook({
      id: `itest_evt_${randomUUID()}`,
      type: "PAYMENT_SUCCEEDED",
      providerRef: winnerRef,
    });
    expect(winnerWebhook.body.outcome).toBe("CONFIRMED");
    expect(await occupiedSpots(parking.id)).toBe(1);

    // Only now does the slow driver's BLIK authorisation land. The money is ours
    // and there is no spot to give them.
    const response = await postWebhook({
      id: `itest_evt_${randomUUID()}`,
      type: "PAYMENT_SUCCEEDED",
      providerRef,
    });

    expect(response.status).toBe(200);
    expect(response.body.outcome).toBe("REFUNDED_NO_SPOT");

    const refunded = await getBooking(lateBooking.id);
    expect(refunded.status).toBe("EXPIRED");
    // The whole amount. The driver did nothing wrong — the cancellation policy
    // has no business here.
    expect(refunded.refundGr).toBe(lateBooking.priceGr);

    const payment = await findPayment(lateBooking.id);
    expect(payment?.status).toBe("REFUNDED");
    expect(payment?.refundedGr).toBe(lateBooking.priceGr);
    expect(payment?.failedReason).toBe("SLOT_TAKEN_AFTER_PAYMENT");

    // The buyer who was on time keeps their spot, untouched.
    const winnerAfter = await getBooking(winnerBooking.id);
    expect(winnerAfter.status).toBe("CONFIRMED");
    expect(winnerAfter.refundGr).toBeNull();
    expect(await occupiedSpots(parking.id)).toBe(1);

    // And the driver hears it from us, now — not from their bank statement on
    // Thursday (docs/PAYMENTS.md §3.2).
    await waitFor(async () => (await notificationsFor(late.id)).length === 1);
    const [notice] = await notificationsFor(late.id);
    expect(notice?.template).toBe("payment-failed:email");
    expect(notice?.status).toBe("SENT");
  });

  it("refunds in full when the booking was cancelled before the money landed", async () => {
    const host = await createHost();
    const driver = await createDriver();
    const parking = await createParking({ ownerId: host.id, capacity: 1 });

    const { booking, providerRef } = await heldBooking(parking.id, driver.id);

    await cancelBooking(booking.id);
    expect((await getBooking(booking.id)).status).toBe("CANCELLED");

    const response = await postWebhook({
      id: `itest_evt_${randomUUID()}`,
      type: "PAYMENT_SUCCEEDED",
      providerRef,
    });

    expect(response.body.outcome).toBe("REFUNDED_CANCELLED");

    const payment = await findPayment(booking.id);
    expect(payment?.status).toBe("REFUNDED");
    expect(payment?.refundedGr).toBe(booking.priceGr);

    // A cancelled booking stays cancelled. It does not spring back to life
    // because a webhook was slow.
    expect((await getBooking(booking.id)).status).toBe("CANCELLED");
    expect(await occupiedSpots(parking.id)).toBe(0);
  });

  it("refuses to confirm a payment whose amount is not the booking's price", async () => {
    const host = await createHost();
    const driver = await createDriver();
    const parking = await createParking({ ownerId: host.id, capacity: 1 });

    const { booking, providerRef } = await heldBooking(parking.id, driver.id);

    // "Nigdy nie ufamy niczemu spoza naszej bazy" (docs/PAYMENTS.md §3.1.3). An
    // event claiming the driver paid a złoty less than we charged is not a reason
    // to hand out a parking space — and not a reason to refund on autopilot
    // either. It is a human's problem, flagged where a human will find it.
    const outcome = await applySucceededPayment({
      bookingId: booking.id,
      providerRef,
      amountGr: booking.priceGr - 100,
      provider: "MANUAL",
    });

    expect(outcome).toBe("AMOUNT_MISMATCH");

    const after = await getBooking(booking.id);
    expect(after.status).toBe("PENDING");
    expect(after.refundGr).toBeNull();

    const payment = await findPayment(booking.id);
    expect(payment?.failedReason).toBe("AMOUNT_MISMATCH");
    expect(payment?.status).not.toBe("SUCCEEDED");
    // The amount on file is ours, computed on the server — never the one the
    // event asserted.
    expect(payment?.amountGr).toBe(booking.priceGr);
  });
});
