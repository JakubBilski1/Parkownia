import { created, handler } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { setAuthCookies } from "@/modules/auth/cookies";
import { signAccessToken } from "@/modules/auth/jwt";
import { issueRefreshToken } from "@/modules/auth/refresh";
import { businessProfileSchema } from "@/modules/auth/schemas";
import { createBusinessProfile, getPublicUser } from "@/modules/auth/service";

export const POST = handler({
  input: businessProfileSchema,
  handle: async ({ input, req }) => {
    const session = await requireUser(req);

    const { roles, verified } = await createBusinessProfile(session.userId, input);

    const accessToken = await signAccessToken({ userId: session.userId, roles });
    const refresh = await issueRefreshToken(session.userId);

    await setAuthCookies({
      accessToken,
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
    });

    return created({
      user: await getPublicUser(session.userId),
      accessToken,
      // False = the registry did not answer; the data is the host's own and
      // will be re-checked before the first payout.
      verified,
    });
  },
});
