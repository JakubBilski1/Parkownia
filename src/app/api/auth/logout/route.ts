import { handler } from "@/lib/api";
import { clearAuthCookies, readRefreshCookie } from "@/modules/auth/cookies";
import { logout } from "@/modules/auth/service";

export const POST = handler({
  handle: async () => {
    // Logout succeeds even without a valid session: the point is that the
    // cookies are gone afterwards, and a 401 here would leave them in place.
    await logout(await readRefreshCookie());
    await clearAuthCookies();
    return { ok: true };
  },
});
