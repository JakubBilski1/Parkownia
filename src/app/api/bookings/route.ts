import { NextResponse } from "next/server";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { toApiError } from "@/modules/bookings/errors";
import { createBookingSchema } from "@/modules/bookings/schemas";
import { placeBooking } from "@/modules/bookings/service";
import { getViewer, grantBookingAccess } from "@/modules/bookings/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** API_SPEC §0: 10/min. Keyed by user when we know them, by IP when we do not — buying without an account is allowed, buying 500 spots a minute is not. */
const LIMIT = 10;
const WINDOW_SECONDS = 60;

/**
 * POST /api/bookings — takes the spot, does not take the money.
 *
 * The response deliberately carries no `code` and no `accessInstructions`: this
 * booking is a 15-minute hold, not a ticket. Those appear after the webhook.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const viewer = await getViewer(request);
    await enforceRateLimit(
      `bookings:${viewer.userId ?? clientIp(request)}`,
      LIMIT,
      WINDOW_SECONDS,
    );

    const parsed = createBookingSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Dane rezerwacji są niepoprawne.",
            details: parsed.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
        },
        { status: 400 },
      );
    }

    const booking = await placeBooking(parsed.data);

    // Bought without an account? The browser still gets a signed, httpOnly claim
    // on this booking, so the QR code is reachable without a login screen.
    await grantBookingAccess(booking.bookingId);

    return NextResponse.json(
      {
        bookingId: booking.bookingId,
        priceGr: booking.priceGr,
        spots: booking.spots,
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        pendingExpiresAt: booking.pendingExpiresAt?.toISOString() ?? null,
      },
      { status: 201 },
    );
  } catch (error) {
    const { status, body, headers } = toApiError(error);
    if (status >= 500) console.error("[api/bookings] ", error);
    return NextResponse.json(body, { status, ...(headers ? { headers } : {}) });
  }
}
