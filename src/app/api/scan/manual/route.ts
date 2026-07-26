import { handler } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { manualScanSchema } from "@/modules/scan/schemas";
import { requireScanContext } from "@/modules/scan/session";
import { validateScan } from "@/modules/scan/validate";
import { SCAN_RATE_LIMIT } from "../rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A code typed in by hand. Same rules as /validate — a dead camera or a dirty
 * screen must not change what a ticket is worth. The route is separate so the
 * manual path can be rate-limited and audited on its own.
 */
export const POST = handler({
  input: manualScanSchema,
  handle: async ({ input, req }) => {
    const { session, hostId } = await requireScanContext(req);
    await enforceRateLimit(
      `scan:${session.userId}`,
      SCAN_RATE_LIMIT.limit,
      SCAN_RATE_LIMIT.windowSeconds,
    );

    return validateScan({
      hostId,
      parkingId: input.parkingId,
      code: input.code,
      ...(input.deviceId ? { deviceId: input.deviceId } : {}),
    });
  },
});
