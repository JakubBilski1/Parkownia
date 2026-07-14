import { created, handler } from "@/lib/api";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { setAuthCookies } from "@/modules/auth/cookies";
import { registerSchema } from "@/modules/auth/schemas";
import { register } from "@/modules/auth/service";

export const POST = handler({
  input: registerSchema,
  handle: async ({ input, req }) => {
    await enforceRateLimit(`auth:${clientIp(req)}`, 5, 60);

    const session = await register(input);

    await setAuthCookies({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      refreshExpiresAt: session.refreshExpiresAt,
    });

    return created({ user: session.user, accessToken: session.accessToken });
  },
});
