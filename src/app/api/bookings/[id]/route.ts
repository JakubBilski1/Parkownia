import { NextResponse } from "next/server";
import { DomainError, toApiError } from "@/modules/bookings/errors";
import { bookingIdSchema } from "@/modules/bookings/schemas";
import { getBookingDetail } from "@/modules/bookings/service";
import { getViewer } from "@/modules/bookings/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/bookings/:id — after CONFIRMED this carries the code, the QR, the
 * access instructions and the entrance point. Before that it carries none of
 * them, and the gate is in the service layer, not here.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const params = bookingIdSchema.safeParse(await context.params);
    if (!params.success) throw new DomainError("BOOKING_NOT_FOUND");

    const viewer = await getViewer();
    const booking = await getBookingDetail(params.data.id, viewer);

    return NextResponse.json({
      ...booking,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      pendingExpiresAt: booking.pendingExpiresAt?.toISOString() ?? null,
      event: booking.event
        ? { ...booking.event, startsAt: booking.event.startsAt.toISOString() }
        : null,
    });
  } catch (error) {
    const { status, body, headers } = toApiError(error);
    if (status >= 500) console.error("[api/bookings/:id] ", error);
    return NextResponse.json(body, { status, ...(headers ? { headers } : {}) });
  }
}
