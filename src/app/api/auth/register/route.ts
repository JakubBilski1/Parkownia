import { created, forbidden, handler, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/session";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/modules/auth/schemas";
import { register } from "@/modules/auth/service";
import { getAdminSession } from "@/modules/admin/session";

/**
 * Creating an account is an admin action for now (docs/API_SPEC.md §1). Signing
 * yourself up is off until the owner wants it back, so this endpoint is what the
 * admin panel calls and nothing else — the /rejestracja screen is gone.
 *
 * It deliberately no longer sets auth cookies. It used to log the new account in,
 * which was right when you were registering yourself and catastrophic now: an
 * admin creating a client would be logged out of their own session and into the
 * client's. The new account gets in with the password the admin hands over.
 */
export const POST = handler({
  input: registerSchema,
  handle: async ({ input, req }) => {
    const session = await getSession();
    if (!session) throw unauthorized("Zaloguj się, aby zakładać konta.");

    const admin = await getAdminSession();
    if (!admin) {
      throw forbidden("Konta zakłada administrator. Poproś o dostęp.");
    }

    // Kept, keyed by IP: an admin session is not a reason to allow a thousand
    // accounts a minute if the cookie is ever stolen.
    await enforceRateLimit(`auth:${clientIp(req)}`, 5, 60);

    const { user } = await register(input);

    return created({ user });
  },
});
