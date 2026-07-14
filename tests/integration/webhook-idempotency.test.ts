import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { webhookEvents } from "@/db/schema";
import { formatDateTimePL } from "@/lib/format";
import { createBooking } from "@/modules/bookings/availability";
import { setEmailProvider } from "@/modules/notifications/email";
import type { EmailMessage, EmailProvider, SendResult } from "@/modules/notifications/provider";
import {
  createDriver,
  createHost,
  createParking,
  findPayment,
  futureWindow,
  getBooking,
  notificationsFor,
  settle,
  waitFor,
} from "./fixtures";
import { postPaymentIntent, postRawWebhook, postWebhook, sessionCookie } from "./http";

/**
 * "Ten sam webhook PRZYJDZIE kilka razy — to pewnik, nie edge case"
 * (docs/PAYMENTS.md §3.1.2).
 *
 * Stripe retries for three days on anything that is not a 200, and it also
 * re-delivers events that were already answered. The second delivery must be a
 * no-op: not a second confirmation, not a second payment row, not a second
 * e-mail with a booking code, and above all not a second charge.
 *
 * The guarantee is a composite primary key on (provider, event_id) and an
 * INSERT ... ON CONFLICT DO NOTHING. That is a database behaviour, which is why
 * this test needs a database — the duplicate must actually collide.
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

async function paidBooking() {
  const host = await createHost();
  const driver = await createDriver();
  const parking = await createParking({ ownerId: host.id, capacity: 1 });

  const { booking } = await createBooking({
    parkingId: parking.id,
    userId: driver.id,
    spots: 1,
    ...futureWindow(),
  });

  const cookies = await sessionCookie(driver.id);
  const intent = await postPaymentIntent({ bookingId: booking.id, method: "BLIK" }, { cookies });
  expect(intent.status).toBe(200);

  return { driver, parking, booking, providerRef: intent.body.providerRef };
}

describe("webhook idempotency: the same event, delivered twice", () => {
  it("confirms once, and the replay changes nothing at all", async () => {
    const { driver, booking, providerRef } = await paidBooking();
    const eventId = `itest_evt_${randomUUID()}`;
    const payload = { id: eventId, type: "PAYMENT_SUCCEEDED", providerRef } as const;

    /* ------------------------------ first delivery ------------------------ */

    const first = await postWebhook(payload);

    expect(first.status).toBe(200);
    expect(first.body.duplicate).toBeUndefined();
    expect(first.body.outcome).toBe("CONFIRMED");

    // The confirmation mail is deliberately sent after the 200 (docs/PAYMENTS.md
    // §3.1.4), so wait for it rather than race it.
    await waitFor(async () => mailbox.sent.length === 1);

    const bookingAfterFirst = await getBooking(booking.id);
    const paymentAfterFirst = await findPayment(booking.id);
    const notificationsAfterFirst = await notificationsFor(driver.id);

    expect(bookingAfterFirst.status).toBe("CONFIRMED");
    expect(paymentAfterFirst?.status).toBe("SUCCEEDED");
    expect(paymentAfterFirst?.amountGr).toBe(booking.priceGr);

    // The mail is the product: it carries the code and the QR the driver shows at
    // the barrier. Asserting it was *sent* is not enough — it has to have rendered.
    // Passing the template a pre-formatted date made it parse "25.07.2026, 20:00"
    // back with new Date(), throw RangeError, and send nothing at all.
    const mail = mailbox.sent[0]!;
    expect(mail.subject).toContain(bookingAfterFirst.code);
    expect(mail.text).toContain(bookingAfterFirst.code);
    expect(mail.text).toContain(formatDateTimePL(booking.startsAt));
    expect(mail.text).not.toMatch(/Invalid Date/i);
    expect(mail.attachments?.[0]?.contentType).toBe("image/png");

    /* ----------------------------- second delivery ------------------------ */

    const second = await postWebhook(payload);

    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
    // Not re-processed: the outcome field is absent on the duplicate path.
    expect(second.body.outcome).toBeUndefined();

    // Anything the replay wrongly scheduled is fire-and-forget, so give it time
    // to happen before asserting that it did not.
    await settle();

    /* --------------------------- zero side effects ------------------------ */

    const bookingAfterSecond = await getBooking(booking.id);
    const paymentAfterSecond = await findPayment(booking.id);
    const notificationsAfterSecond = await notificationsFor(driver.id);

    // updated_at is the tell: any second write to these rows moves it, even one
    // that happens to write the same values.
    expect(bookingAfterSecond).toEqual(bookingAfterFirst);
    expect(paymentAfterSecond).toEqual(paymentAfterFirst);
    expect(notificationsAfterSecond).toEqual(notificationsAfterFirst);

    // One mail, carrying one booking code. A driver who gets two is a driver who
    // wonders whether he paid twice.
    expect(mailbox.sent).toHaveLength(1);

    const claimed = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.eventId, eventId));

    expect(claimed).toHaveLength(1);
    expect(claimed[0]?.processedAt).not.toBeNull();
  });

  it("survives five simultaneous deliveries of the same event", async () => {
    const { driver, booking, providerRef } = await paidBooking();
    const payload = {
      id: `itest_evt_${randomUUID()}`,
      type: "PAYMENT_SUCCEEDED",
      providerRef,
    } as const;

    // Stripe's retries are not politely spaced when a receiver is slow: the same
    // event can be in flight several times at once.
    const responses = await Promise.all(Array.from({ length: 5 }, () => postWebhook(payload)));

    expect(responses.every((response) => response.status === 200)).toBe(true);

    await waitFor(async () => (await getBooking(booking.id)).status === "CONFIRMED");
    await settle();

    expect(mailbox.sent).toHaveLength(1);
    expect(await notificationsFor(driver.id)).toHaveLength(1);

    const payment = await findPayment(booking.id);
    expect(payment?.status).toBe("SUCCEEDED");
    expect(payment?.refundedGr).toBe(0);
  });

  it("answers 400 to a body it cannot verify, and records nothing", async () => {
    const before = await db.select().from(webhookEvents);

    // Verification comes before parsing and before the database (docs/PAYMENTS.md
    // §3.1.1). A body that fails it must leave no trace — including no claimed
    // event id, which would make the genuine retry look like a duplicate.
    const response = await postRawWebhook("}{ not json at all");

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ received: false });
    expect(await db.select().from(webhookEvents)).toHaveLength(before.length);
  });

  it("answers 404 for a provider that is not the configured one", async () => {
    const response = await postWebhook(
      { id: `itest_evt_${randomUUID()}`, type: "PAYMENT_SUCCEEDED" },
      "stripe",
    );

    // PAYMENT_PROVIDER=mock, so /api/webhooks/stripe is not a route that can be
    // used to mint a paid booking.
    expect(response.status).toBe(404);
  });
});
