import { created, handler } from "@/lib/api";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { leadInputSchema } from "@/modules/leads/schemas";
import { createLead } from "@/modules/leads/service";

/**
 * Public lead capture for /dla-wlascicieli. Anonymous form, so the defences are:
 * server-side Zod, an IP rate limit, and a honeypot. The stored revenue estimate
 * is recomputed on the server — the browser's numbers are never trusted.
 */
export const dynamic = "force-dynamic";

export const POST = handler({
  input: leadInputSchema,
  handle: async ({ input, req }) => {
    await enforceRateLimit(`lead:${clientIp(req)}`, 5, 60);

    // A human never fills the hidden field. Answer 201 anyway so a bot learns
    // nothing from the response — but write nothing.
    if (input.website && input.website.trim().length > 0) {
      return created({ ok: true });
    }

    await createLead(input, { userAgent: req.headers.get("user-agent") });
    return created({ ok: true });
  },
});
