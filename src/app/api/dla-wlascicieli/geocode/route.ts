import { AppError, handler, serviceUnavailable } from "@/lib/api";
import { GeocoderError, geocode } from "@/lib/geocoder";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { publicGeocodeQuerySchema } from "@/modules/leads/schemas";

/**
 * Public, anonymous geocoder for the owners' landing. Only the address STRING is
 * sent upstream — never a lead's name / phone / e-mail (RODO minimisation, art. 5
 * ust. 1 lit. c). No session to key on, so the limiter keys on the client IP.
 */
export const dynamic = "force-dynamic";

export const GET = handler({
  input: publicGeocodeQuerySchema,
  handle: async ({ input, req }) => {
    /*
     * The limiter counts in Postgres. If that store is unreachable we still do
     * not proxy — an uncounted public passthrough to the upstream geocoder is
     * exactly what the limit exists to prevent — but the caller gets the same
     * "search is down, use the map" answer as any other outage instead of a
     * bare 500. Over-limit stays a 429: that is an AppError and it goes up
     * untouched.
     */
    try {
      await enforceRateLimit(`geocode-public:${clientIp(req)}`, 20, 60);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw serviceUnavailable(
        "SEARCH_UNAVAILABLE",
        "Wyszukiwarka adresów nie odpowiada. Wskaż punkt na mapie albo spróbuj za chwilę.",
      );
    }

    try {
      return { items: await geocode(input.q) };
    } catch (error) {
      if (error instanceof GeocoderError || error instanceof TypeError) {
        throw serviceUnavailable(
          "GEOCODER_UNAVAILABLE",
          "Wyszukiwarka adresów nie odpowiada. Wskaż punkt na mapie albo spróbuj za chwilę.",
        );
      }
      throw error;
    }
  },
});
