import { z } from "zod";
import { forbidden, handler } from "@/lib/api";
import { isHost, requireUser } from "@/lib/session";
import { getHostOnboardingStatus, refreshHostAccountState } from "@/modules/payments/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  /**
   * Set by the page the host lands on when Stripe returns them from the hosted
   * form. It costs one API call to Stripe, so it is opt-in rather than the
   * default: the webhook is what normally writes these flags, and polling Stripe
   * on every dashboard render would be a rate limit waiting to happen.
   */
  refresh: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

/** GET /api/host/stripe/status → { connected, chargesEnabled, payoutsEnabled, required } */
export const GET = handler({
  input: querySchema,
  handle: async ({ req, input }) => {
    const session = await requireUser(req);
    if (!isHost(session)) {
      throw forbidden("Weryfikację w Stripe przechodzą tylko konta hostów.");
    }

    return input.refresh
      ? refreshHostAccountState(session.userId)
      : getHostOnboardingStatus(session.userId);
  },
});
