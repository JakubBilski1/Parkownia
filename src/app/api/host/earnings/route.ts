import { handler, forbidden } from "@/lib/api";
import { isHost, requireUser } from "@/lib/session";
import { getHostEarnings } from "@/modules/payouts/report";

/**
 * GET /api/host/earnings (docs/API_SPEC.md §8). The host dashboard has been
 * calling this since it was written; the route did not exist, so every host saw
 * a failed fetch where their money should be.
 */
export const GET = handler({
  handle: async ({ req }) => {
    const session = await requireUser(req);
    if (!isHost(session)) {
      throw forbidden("To konto nie udostępnia jeszcze parkingów.");
    }

    return getHostEarnings(session.userId);
  },
});
