import { handler } from "@/lib/api";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { reachQuerySchema } from "@/modules/leads/schemas";
import { computeReach } from "@/modules/leads/service";

/**
 * Reach + revenue potential for a point, computed server-side from real PostGIS
 * distance and a real event count. Anonymous; IP rate-limited.
 */
export const dynamic = "force-dynamic";

export const GET = handler({
  input: reachQuerySchema,
  handle: async ({ input, req }) => {
    await enforceRateLimit(`reach:${clientIp(req)}`, 30, 60);
    return computeReach({ lat: input.lat, lng: input.lng });
  },
});
