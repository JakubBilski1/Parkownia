import { handler } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";
import { nipLookupSchema } from "@/modules/auth/schemas";
import { lookupCompanyByNip } from "@/modules/auth/service";

/**
 * The Zod schema rejects a bad checksum before we get here, so a typo never
 * costs a call to the Ministry's registry. A registry outage surfaces as 503
 * (WHITELIST_UNAVAILABLE) and the form falls back to typing the data by hand.
 */
export const GET = handler({
  input: nipLookupSchema,
  handle: async ({ input, req }) => {
    const session = await requireUser(req);
    await enforceRateLimit(`nip:${session.userId}`, 3, 60);

    return lookupCompanyByNip(input.nip);
  },
});
