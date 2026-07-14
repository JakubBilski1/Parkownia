import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, events, parkings, users } from "@/db/schema";
import { sendNotification } from "@/modules/notifications";

/**
 * Timestamps go into a notification payload as ISO-8601, never pre-formatted.
 *
 * The templates are the presentation layer and they format for themselves —
 * `formatDateTimePL()` in the component, `Europe/Warsaw` at the last possible
 * moment (CLAUDE.md: "konwersja na Europe/Warsaw dopiero w warstwie prezentacji").
 * Handing them "25.07.2026, 20:00" made the component parse that back with
 * `new Date()`, which yields Invalid Date, which threw RangeError out of every
 * booking e-mail we have ever tried to send.
 *
 * The payload types could not catch it: a Polish date is a `string` and so is an
 * ISO date. Only rendering the template against a real booking does.
 */
function iso(value: Date): string {
  return value.toISOString();
}

/**
 * Mail and SMS never block the webhook's 200 (docs/PAYMENTS.md §3.1.4): Stripe
 * retries for three days if we are slow, and a driver's confirmation mail is not
 * worth a retry storm. We answer first and send after.
 *
 * This is a floating promise on purpose, and it is safe *because* ParkSpot is a
 * long-lived Node process on a VPS (docs/ARCHITECTURE.md §1). If this ever moves
 * to a serverless runtime, this call has to become waitUntil() or a real queue —
 * otherwise the process dies with the mail still in it.
 */
export function fireAndForget(work: Promise<unknown>, label: string): void {
  void work.catch((error) => {
    console.error(`[notify] ${label} failed`, error instanceof Error ? error.message : error);
  });
}

async function loadContext(bookingId: string) {
  const rows = await db
    .select({
      booking: bookings,
      email: users.email,
      phone: users.phone,
      firstName: users.firstName,
      parkingTitle: parkings.title,
      address: parkings.address,
      entranceLocation: parkings.entranceLocation,
      entranceNotes: parkings.entranceNotes,
      accessInstructions: parkings.accessInstructions,
      eventTitle: events.title,
    })
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.userId))
    .innerJoin(parkings, eq(parkings.id, bookings.parkingId))
    .leftJoin(events, eq(events.id, bookings.eventId))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  return rows[0] ?? null;
}

/** The mail that carries the code and the QR. Sent only after the money is in. */
export async function notifyBookingConfirmed(bookingId: string): Promise<void> {
  const context = await loadContext(bookingId);
  if (!context) return;

  await sendNotification({
    template: "booking-confirmed",
    recipient: {
      userId: context.booking.userId,
      email: context.email,
      phone: context.phone,
    },
    relatedId: bookingId,
    payload: {
      firstName: context.firstName,
      code: context.booking.code,
      bookingId,
      parkingTitle: context.parkingTitle ?? "Parking",
      address: context.address ?? "",
      startsAt: iso(context.booking.startsAt),
      endsAt: iso(context.booking.endsAt),
      spots: context.booking.spots,
      priceGr: context.booking.priceGr,
      eventTitle: context.eventTitle,
      entranceNotes: context.entranceNotes,
      entranceLat: context.entranceLocation?.lat ?? null,
      entranceLng: context.entranceLocation?.lng ?? null,
      // Released here for the same reason it is released in the API: the booking
      // is paid for.
      accessInstructions: context.accessInstructions,
    },
  });
}

export async function notifyBookingCancelled(
  bookingId: string,
  input: { refundGr: number; cancelledBy: "DRIVER" | "HOST" | "ADMIN"; reason?: string | null },
): Promise<void> {
  const context = await loadContext(bookingId);
  if (!context) return;

  await sendNotification({
    template: "booking-cancelled",
    recipient: {
      userId: context.booking.userId,
      email: context.email,
      phone: context.phone,
    },
    relatedId: bookingId,
    payload: {
      firstName: context.firstName,
      code: context.booking.code,
      parkingTitle: context.parkingTitle ?? "Parking",
      startsAt: iso(context.booking.startsAt),
      priceGr: context.booking.priceGr,
      refundGr: input.refundGr,
      cancelledBy: input.cancelledBy,
      reason: input.reason ?? null,
    },
  });
}

/**
 * Two very different mails behind one template:
 *   charged = false → the card was declined, no money moved, the hold is alive
 *   charged = true  → the money DID move and the spot was gone; we are sending it
 *                     back. This is the "PENDING expired, webhook succeeded" case
 *                     from docs/PAYMENTS.md §3.2, and it must never be silent.
 */
export async function notifyPaymentFailed(
  bookingId: string,
  input: { charged: boolean },
): Promise<void> {
  const context = await loadContext(bookingId);
  if (!context) return;

  await sendNotification({
    template: "payment-failed",
    recipient: {
      userId: context.booking.userId,
      email: context.email,
      phone: context.phone,
    },
    relatedId: bookingId,
    payload: {
      firstName: context.firstName,
      bookingId,
      parkingTitle: context.parkingTitle ?? "Parking",
      priceGr: context.booking.priceGr,
      charged: input.charged,
      holdExpiresAt: context.booking.pendingExpiresAt
        ? iso(context.booking.pendingExpiresAt)
        : null,
    },
  });
}
