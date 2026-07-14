import { handler } from "@/lib/api";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";
import { setAuthCookies } from "@/modules/auth/cookies";
import { signAccessToken } from "@/modules/auth/jwt";
import { issueRefreshToken } from "@/modules/auth/refresh";
import { upgradeToHostSchema } from "@/modules/auth/schemas";
import { getPublicUser, upgradeToHostIndividual } from "@/modules/auth/service";

export const POST = handler({
  input: upgradeToHostSchema,
  handle: async ({ req }) => {
    await enforceRateLimit(`auth:${clientIp(req)}`, 5, 60);

    const session = await requireUser(req);
    const roles = await upgradeToHostIndividual(session.userId);

    // The access token carries the roles and the middleware trusts it. Without
    // a fresh pair here, a brand-new host would be bounced out of /panel for up
    // to fifteen minutes by their own stale token.
    const accessToken = await signAccessToken({ userId: session.userId, roles });
    const refresh = await issueRefreshToken(session.userId);

    await setAuthCookies({
      accessToken,
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
    });

    return { user: await getPublicUser(session.userId), accessToken };
  },
});
