import { handler } from "@/lib/api";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { clearAuthCookies } from "@/modules/auth/cookies";
import { passwordResetConfirmSchema } from "@/modules/auth/schemas";
import { confirmPasswordReset } from "@/modules/auth/service";

export const POST = handler({
  input: passwordResetConfirmSchema,
  handle: async ({ input, req }) => {
    await enforceRateLimit(`auth:${clientIp(req)}`, 5, 60);

    await confirmPasswordReset(input.token, input.password);

    // Every session of this account was just revoked, including this browser's.
    await clearAuthCookies();

    return { ok: true };
  },
});
