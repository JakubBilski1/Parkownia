import { z } from "zod";
import { annotateConsent, parseRecipients } from "@/modules/admin/campaigns";
import { handle } from "@/modules/admin/http";
import { requireAdmin } from "@/modules/admin/session";

const bodySchema = z.object({
  recipientsJson: z.string().min(2).max(200_000),
});

/**
 * Checks a pasted list without sending anything: parses it, collapses duplicates,
 * reports what it could not read, and labels every address with the marketing
 * consent we hold. A POST because the list can be 200 KB of JSON.
 */
export async function POST(request: Request) {
  return handle(async () => {
    await requireAdmin();

    const { recipientsJson } = bodySchema.parse(await request.json());
    const parsed = parseRecipients(recipientsJson);
    const recipients = await annotateConsent(parsed.recipients);

    return {
      recipients,
      invalid: parsed.invalid,
      duplicates: parsed.duplicates,
      truncated: parsed.truncated,
      counts: {
        total: recipients.length,
        granted: recipients.filter((r) => r.consent === "GRANTED").length,
        missing: recipients.filter((r) => r.consent === "MISSING").length,
        unknown: recipients.filter((r) => r.consent === "UNKNOWN").length,
      },
    };
  });
}
