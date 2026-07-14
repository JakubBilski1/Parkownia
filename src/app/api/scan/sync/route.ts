import { handler } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { syncBatchSchema } from "@/modules/scan/schemas";
import { requireScanner } from "@/modules/scan/session";
import { syncOfflineScans } from "@/modules/scan/sync";
import { SCAN_RATE_LIMIT } from "../rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One request per drained queue, not per scan — the rate limit is charged once
 * for the batch. A host coming back into coverage with 180 queued scans must
 * not be throttled for having done their job.
 */
export const POST = handler({
  input: syncBatchSchema,
  handle: async ({ input, req }) => {
    const session = await requireScanner(req);
    await enforceRateLimit(
      `scan:${session.userId}`,
      SCAN_RATE_LIMIT.limit,
      SCAN_RATE_LIMIT.windowSeconds,
    );

    const resolutions = await syncOfflineScans(session.userId, input.scans);
    return { resolutions };
  },
});
