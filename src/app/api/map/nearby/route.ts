import { NextResponse, type NextRequest } from "next/server";
import { estimateWalk } from "@/lib/format";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { badRequest, errorResponse } from "@/modules/parkings/errors";
import { findParkingsNearby } from "@/modules/parkings/queries";
import { nearbySchema, parkingFiltersSchema } from "@/modules/parkings/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Public, unauthenticated, and it runs a PostGIS radius query — same ceiling
    // as the bbox endpoint, same reason.
    await enforceRateLimit(`map:${clientIp(request)}`, 120, 60);

    const params = Object.fromEntries(request.nextUrl.searchParams);

    const query = nearbySchema.safeParse(params);
    if (!query.success) {
      throw badRequest(query.error);
    }

    const filters = parkingFiltersSchema.safeParse(params);
    if (!filters.success) {
      throw badRequest(filters.error);
    }

    const { lat, lng, radius, limit } = query.data;
    const rows = await findParkingsNearby({ lat, lng }, radius, limit, filters.data);

    // The walking numbers are a detoured straight line, never a routed path, so the
    // flag travels with them and the UI is obliged to say "ok." (src/lib/format.ts).
    const items = rows.map((row) => {
      const walk = estimateWalk(row.straightLineMeters);
      return {
        ...row,
        walkDistanceMeters: walk.meters,
        walkMinutes: walk.minutes,
        isApproximate: true as const,
      };
    });

    return NextResponse.json({ items });
  } catch (error) {
    return errorResponse(error);
  }
}
