import { handler } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { clearAuthCookies } from "@/modules/auth/cookies";
import { deleteAccount, getProfile } from "@/modules/users/service";

export const GET = handler({
  handle: async ({ req }) => {
    const session = await requireUser(req);
    return getProfile(session.userId);
  },
});

/**
 * RODO: deletion is anonymisation (docs/DATA_MODEL.md §10). Bookings and
 * payments stay for accounting; the person disappears from them. 409 when a
 * booking is still ahead — see modules/users/service.ts.
 */
export const DELETE = handler({
  handle: async ({ req }) => {
    const session = await requireUser(req);

    await deleteAccount(session.userId);
    await clearAuthCookies();

    return { ok: true };
  },
});
