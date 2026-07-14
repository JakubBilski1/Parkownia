import { NextResponse } from "next/server";
import { toApiError } from "@/modules/bookings/errors";
import { listBookings } from "@/modules/bookings/service";
import { getViewer } from "@/modules/bookings/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live booking first, then upcoming, then history (DESIGN_PRINCIPLES §6.5). */
export async function GET(): Promise<NextResponse> {
  try {
    const viewer = await getViewer();
    const items = await listBookings(viewer);

    return NextResponse.json({
      items: items.map((item) => ({
        ...item,
        startsAt: item.startsAt.toISOString(),
        endsAt: item.endsAt.toISOString(),
        pendingExpiresAt: item.pendingExpiresAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    const { status, body, headers } = toApiError(error);
    if (status >= 500) console.error("[api/bookings/mine] ", error);
    return NextResponse.json(body, { status, ...(headers ? { headers } : {}) });
  }
}
