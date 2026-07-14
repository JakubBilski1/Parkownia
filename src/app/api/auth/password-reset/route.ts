import { handler } from "@/lib/api";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { passwordResetRequestSchema } from "@/modules/auth/schemas";
import { requestPasswordReset } from "@/modules/auth/service";

export const POST = handler({
  input: passwordResetRequestSchema,
  handle: async ({ input, req }) => {
    await enforceRateLimit(`auth:${clientIp(req)}`, 5, 60);

    await requestPasswordReset(input.email);

    // Always the same answer. Anything else turns this endpoint into a tool for
    // checking which e-mail addresses have accounts here.
    return { ok: true };
  },
});
