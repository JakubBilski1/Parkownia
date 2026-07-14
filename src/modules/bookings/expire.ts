import { sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";

export type ExpiryResult = { expired: number };

/**
 * The lazy half of TTL enforcement lives in the occupancy query, which only
 * counts PENDING rows whose `pending_expires_at` is still in the future — so an
 * abandoned checkout stops blocking a spot the second it lapses, cron or no
 * cron. This job is the tidy-up: it makes the status column tell the truth, so
 * "moje rezerwacje" does not show a dead PENDING row forever.
 *
 * A booking whose payment already SUCCEEDED is never expired here. That row is
 * the late-webhook case and belongs to confirmPaidBooking(), which re-checks the
 * spot under lock and refunds if it is gone.
 */
export async function expirePendingBookings(): Promise<ExpiryResult> {
  const expired = await db
    .update(bookings)
    .set({ status: "EXPIRED", pendingExpiresAt: null, updatedAt: sql`now()` })
    .where(
      sql`${bookings.status} = 'PENDING'
        AND ${bookings.pendingExpiresAt} IS NOT NULL
        AND ${bookings.pendingExpiresAt} <= now()
        AND NOT EXISTS (
          SELECT 1 FROM payments p
           WHERE p.booking_id = ${bookings.id}
             AND p.status IN ('SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED')
        )`,
    )
    .returning({ id: bookings.id });

  return { expired: expired.length };
}
