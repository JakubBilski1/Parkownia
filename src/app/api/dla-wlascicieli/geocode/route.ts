import { handler, serviceUnavailable } from "@/lib/api";
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
    await enforceRateLimit(`geocode-public:${clientIp(req)}`, 20, 60);
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
