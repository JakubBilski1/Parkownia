import { handler } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { validateScanSchema } from "@/modules/scan/schemas";
import { requireScanContext } from "@/modules/scan/session";
import { validateScan } from "@/modules/scan/validate";
import { SCAN_RATE_LIMIT } from "../rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler({
  input: validateScanSchema,
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
      ...(input.code ? { code: input.code } : {}),
      ...(input.codeHash ? { codeHash: input.codeHash } : {}),
      ...(input.deviceId ? { deviceId: input.deviceId } : {}),
    });
  },
});
