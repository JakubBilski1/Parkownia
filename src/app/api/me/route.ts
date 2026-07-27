import { handler } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { clearAuthCookies } from "@/modules/auth/cookies";
import { updateProfileSchema } from "@/modules/users/schemas";
import { deleteAccount, getProfile, updateProfile } from "@/modules/users/service";

export const GET = handler({
  handle: async ({ req }) => {
    const session = await requireUser(req);
    return getProfile(session.userId);
  },
});

/**
 * RODO art. 16: the user corrects their own data. Sends back the whole profile,
 * so the client never has to guess what the server made of the input — the phone
 * it echoes is the normalised one (+48…), not the string that was typed.
 */
export const PATCH = handler({
  input: updateProfileSchema,
  handle: async ({ input, req }) => {
    const session = await requireUser(req);
    return updateProfile(session.userId, input);
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
