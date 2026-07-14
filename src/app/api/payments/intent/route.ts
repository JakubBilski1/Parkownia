import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { DomainError, toApiError } from "@/modules/bookings/errors";
import { paymentIntentSchema } from "@/modules/bookings/schemas";
import { canViewBooking, getViewer } from "@/modules/bookings/session";
import { createPaymentIntentForBooking } from "@/modules/payments/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/intent — {bookingId, method}. That is the entire contract.
 *
 * There is no `amount` field, and adding one would be the single most expensive
 * line of code in this repository: the charge is built from booking.price_gr,
 * which the server computed under lock when the spot was taken.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const viewer = await getViewer(request);
    await enforceRateLimit(`payments:${viewer.userId ?? clientIp(request)}`, 10, 60);

    const parsed = paymentIntentSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: "Nieprawidłowe dane płatności." } },
        { status: 400 },
      );
    }

    const rows = await db
      .select({ id: bookings.id, userId: bookings.userId })
      .from(bookings)
      .where(eq(bookings.id, parsed.data.bookingId))
      .limit(1);

    const booking = rows[0];
    if (!booking) throw new DomainError("BOOKING_NOT_FOUND");
    if (!canViewBooking(viewer, booking)) throw new DomainError("FORBIDDEN");

    const intent = await createPaymentIntentForBooking({
      bookingId: parsed.data.bookingId,
      method: parsed.data.method,
    });

    return NextResponse.json(intent);
  } catch (error) {
    const { status, body, headers } = toApiError(error);
    if (status >= 500) console.error("[api/payments/intent] ", error);
    return NextResponse.json(body, { status, ...(headers ? { headers } : {}) });
  }
}
