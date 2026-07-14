import { handler } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { listConsents, setMarketingConsents } from "@/modules/users/consents";
import { updateConsentsSchema } from "@/modules/users/schemas";

export const GET = handler({
  handle: async ({ req }) => {
    const session = await requireUser(req);
    return { consents: await listConsents(session.userId) };
  },
});

export const PUT = handler({
  input: updateConsentsSchema,
  handle: async ({ input, req }) => {
    const session = await requireUser(req);
    return { consents: await setMarketingConsents(session.userId, input) };
  },
});
