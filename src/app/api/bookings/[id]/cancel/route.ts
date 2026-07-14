import { NextResponse } from "next/server";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cancelBooking, previewCancellation } from "@/modules/bookings/cancel";
import { DomainError, toApiError } from "@/modules/bookings/errors";
import { bookingIdSchema } from "@/modules/bookings/schemas";
import { canViewBooking, getViewer } from "@/modules/bookings/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOwnership(bookingId: string): Promise<void> {
  const rows = await db
    .select({ id: bookings.id, userId: bookings.userId })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);

  const booking = rows[0];
  if (!booking) throw new DomainError("BOOKING_NOT_FOUND");

  const viewer = await getViewer();
  if (!canViewBooking(viewer, booking)) throw new DomainError("FORBIDDEN");
}

/**
 * POST /api/bookings/:id/cancel
 *   ?preview=true → what it will cost, before anything happens
 *   (no query)    → cancel and refund
 *
 * The preview is not a nicety. "Anulowanie ma jasno opisane konsekwencje ZANIM
 * użytkownik kliknie" (DESIGN_PRINCIPLES §6.3) — the UI is required to call it
 * first, and this endpoint makes that cheap.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const params = bookingIdSchema.safeParse(await context.params);
    if (!params.success) throw new DomainError("BOOKING_NOT_FOUND");

    await assertOwnership(params.data.id);

    const preview = new URL(request.url).searchParams.get("preview") === "true";

    if (preview) {
      const quote = await previewCancellation(params.data.id);
      return NextResponse.json({
        refundGr: quote.refundGr,
        refundPct: quote.refundPct,
        priceGr: quote.priceGr,
        hoursBefore: quote.hoursBefore,
        policy: { id: quote.policy.id, name: quote.policy.name, rules: quote.policy.rules },
      });
    }

    const result = await cancelBooking(params.data.id);

    return NextResponse.json({
      cancelled: true,
      refundGr: result.refundGr,
      refundPct: result.refundPct,
      // Honest about the failure mode: the booking IS cancelled, the money is
      // still on its way back, and we say so instead of showing a green tick.
      refundPending: result.refundPending,
    });
  } catch (error) {
    const { status, body, headers } = toApiError(error);
    if (status >= 500) console.error("[api/bookings/:id/cancel] ", error);
    return NextResponse.json(body, { status, ...(headers ? { headers } : {}) });
  }
}
