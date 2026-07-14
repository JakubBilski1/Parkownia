import { NextResponse, type NextRequest } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { geocode, GeocoderError, reverseGeocode } from "@/lib/geocoder";
import { ApiError, badRequest, errorResponse } from "@/modules/parkings/errors";
import { geocodeQuerySchema } from "@/modules/parkings/schemas";
import { requireSession } from "@/modules/parkings/session";

export const dynamic = "force-dynamic";

/**
 * A proxy, not a passthrough: the provider key stays on the server, the results are
 * cached in-process, and Nominatim's 1 req/s ceiling is enforced inside the client
 * (src/lib/geocoder.ts). Logged in only — an open geocoder is someone else's quota
 * to burn.
 *
 * Being logged in is not by itself a budget: one account typing into the address
 * field can still spend a paid Geoapify quota. 30/min is more than a human types
 * and far less than a script costs.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession(request);
    await enforceRateLimit(`geocode:${session.userId}`, 30, 60);

    const parsed = geocodeQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!parsed.success) {
      throw badRequest(parsed.error);
    }

    const { q, lat, lng } = parsed.data;

    try {
      if (q) {
        return NextResponse.json({ items: await geocode(q) });
      }

      const result = await reverseGeocode(lat as number, lng as number);
      return NextResponse.json({ items: result ? [result] : [] });
    } catch (error) {
      if (error instanceof GeocoderError || error instanceof TypeError) {
        throw new ApiError(
          "UPSTREAM_UNAVAILABLE",
          "Wyszukiwarka adresów nie odpowiada. Wskaż parking na mapie albo spróbuj za chwilę.",
        );
      }
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
