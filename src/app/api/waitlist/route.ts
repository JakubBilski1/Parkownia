import { created, handler } from "@/lib/api";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { addToWaitlist, waitlistInputSchema } from "@/modules/bookings/waitlist";

/**
 * "Tell me when you launch", from the closed checkout. Public and anonymous, so
 * the same three defences as the owners' lead form: server-side Zod, an IP rate
 * limit, and a honeypot.
 */
export const dynamic = "force-dynamic";

export const POST = handler({
  input: waitlistInputSchema,
  handle: async ({ input, req }) => {
    await enforceRateLimit(`waitlist:${clientIp(req)}`, 5, 60);

    // Answer 201 either way, so a bot learns nothing from the response.
    if (input.website && input.website.trim().length > 0) {
      return created({ ok: true });
    }

    await addToWaitlist(input);
    return created({ ok: true });
  },
});
