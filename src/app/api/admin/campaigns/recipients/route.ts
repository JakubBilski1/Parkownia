import { z } from "zod";
import { annotateConsent, parseRecipients } from "@/modules/admin/campaigns";
import { handle } from "@/modules/admin/http";
import { requireAdmin } from "@/modules/admin/session";
import { findSuppressed } from "@/modules/admin/unsubscribe";

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
    const annotated = await annotateConsent(parsed.recipients);

    // Shown here as well as enforced at send time. The operator should find out
    // that a third of a bought list has already unsubscribed while they can
    // still do something about it, not in the summary afterwards.
    const suppressed = await findSuppressed(annotated.map((r) => r.email));
    const recipients = annotated.map((recipient) => ({
      ...recipient,
      suppressed: suppressed.has(recipient.email),
    }));

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
        suppressed: suppressed.size,
      },
    };
  });
}
