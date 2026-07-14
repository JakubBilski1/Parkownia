import { handler } from "@/lib/api";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { setAuthCookies } from "@/modules/auth/cookies";
import { loginSchema } from "@/modules/auth/schemas";
import { login } from "@/modules/auth/service";

export const POST = handler({
  input: loginSchema,
  handle: async ({ input, req }) => {
    await enforceRateLimit(`auth:${clientIp(req)}`, 5, 60);

    const session = await login(input);

    await setAuthCookies({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      refreshExpiresAt: session.refreshExpiresAt,
    });

    return { user: session.user, accessToken: session.accessToken };
  },
});
