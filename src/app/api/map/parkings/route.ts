import { NextResponse, type NextRequest } from "next/server";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { badRequest, errorResponse } from "@/modules/parkings/errors";
import { findParkingsInBbox, MAP_PIN_LIMIT } from "@/modules/parkings/queries";
import { bboxSchema, parkingFiltersSchema } from "@/modules/parkings/schemas";

export const dynamic = "force-dynamic";

/**
 * Fired on every pan of the map, so the payload is deliberately thin: what a 60 px
 * pin can show and nothing more. The client debounces (300 ms) and clusters.
 *
 * Public and unauthenticated, which makes it the cheapest way to make our database
 * do work — hence a per-IP ceiling. It is set well above what panning a map costs a
 * real person (debounced to ~1 req per 300 ms of movement) and well below what a
 * scraper wants.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await enforceRateLimit(`map:${clientIp(request)}`, 120, 60);

    const params = request.nextUrl.searchParams;

    const bbox = bboxSchema.safeParse(params.get("bbox") ?? "");
    if (!bbox.success) {
      throw badRequest(bbox.error);
    }

    const filters = parkingFiltersSchema.safeParse(Object.fromEntries(params));
    if (!filters.success) {
      throw badRequest(filters.error);
    }

    const items = await findParkingsInBbox(bbox.data, filters.data);

    return NextResponse.json(
      { items, limit: MAP_PIN_LIMIT, truncated: items.length === MAP_PIN_LIMIT },
      { headers: { "Cache-Control": "private, max-age=15" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
