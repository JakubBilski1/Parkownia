import { NextResponse } from "next/server";
import { expirePendingBookings } from "@/modules/bookings/expire";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Every minute. Cheap, idempotent, and safe to miss — the occupancy query already ignores lapsed holds. */
export async function POST(request: Request): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const result = await expirePendingBookings();
  return NextResponse.json(result);
}

export const GET = POST;
