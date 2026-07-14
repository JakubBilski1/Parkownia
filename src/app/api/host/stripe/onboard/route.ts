import { forbidden, handler, serviceUnavailable } from "@/lib/api";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { isHost, requireUser } from "@/lib/session";
import { OnboardingUnavailableError, startHostOnboarding } from "@/modules/payments/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/host/stripe/onboard → { url }
 *
 * Returns a one-time link to Stripe's hosted KYC (docs/PAYMENTS.md §2.2). The
 * link is minted per click and never stored: it expires in minutes, and a stored
 * one is a dead link the host clicks on a Saturday.
 *
 * There is no body. The account is built from the host's own record — a client
 * that could name the e-mail or the business type of the account it is opening
 * could open one in somebody else's name.
 */
export const POST = handler({
  handle: async ({ req }) => {
    const session = await requireUser(req);
    if (!isHost(session)) {
      throw forbidden("Weryfikację w Stripe przechodzą tylko konta hostów.");
    }

    // Each click creates a Stripe API call; a stuck button must not turn into a
    // hundred of them.
    await enforceRateLimit(`stripe-onboard:${session.userId ?? clientIp(req)}`, 10, 60);

    try {
      return await startHostOnboarding(session.userId);
    } catch (error) {
      if (error instanceof OnboardingUnavailableError) {
        throw serviceUnavailable(
          "ONBOARDING_UNAVAILABLE",
          "Weryfikacja wypłat jest chwilowo niedostępna. Twoje dane są zapisane — wróć tu za chwilę.",
        );
      }
      throw error;
    }
  },
});
