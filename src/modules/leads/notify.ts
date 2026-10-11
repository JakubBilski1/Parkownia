import { formatDateTimePL, formatMoney, formatSpots } from "@/lib/format";
import { getEmailProvider } from "@/modules/notifications";
import { LEAD_OBJECT_TYPE_LABEL } from "@/modules/admin/labels";
import type { LeadInput } from "./schemas";

const DEFAULT_RECIPIENT = "kontakt@parkownia.com";

/**
 * The alert that says a stranger just offered us parking. It does NOT go through
 * sendNotification(): that path writes notification_log, which is keyed on a
 * user_id, and a lead has no account. Nothing here is deduped in the database
 * either — one submitted form is one insert is one mail — but the idempotency key
 * still stops a retried request from mailing twice.
 *
 * Never throws. A lead that reached the database is captured; failing the request
 * because our own mail is down would throw away the thing we are paying to get.
 */
export async function notifyNewLead(
  leadId: string,
  input: LeadInput,
  estimate: {
    estimatedRateGr: number | null;
    estimatedAnnualGrossGr: number | null;
    eventsInReach: number | null;
    walkMinutesEnea: number | null;
    walkMinutesMtp: number | null;
  },
): Promise<void> {
  const to = process.env.LEAD_ALERT_EMAIL || DEFAULT_RECIPIENT;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://parkownia.com").replace(/\/$/, "");

  // Display-ready and pre-branched, like every other template payload: the mail
  // renderer only knows {{var}} and {{#if bool}} (modules/notifications/templates.ts).
  //
  // Never null: pbdevs counts every name the template mentions — {{#if x}} included —
  // as required, and rejects the whole send with 422 when one of them is null or
  // missing. Absent text is "" (falsy for {{#if}}), absent flags are false.
  const data = {
    // The dashboard subject is just {{subject}}, as for owner-campaign, so the
    // copy stays in this repo (docs/mail-templates/owner-lead.mjml).
    subject: `Nowy lead: ${input.contactName}, ${formatSpots(input.spots)} — ${input.address}`,
    receivedAt: formatDateTimePL(new Date()),
    contactName: input.contactName,
    phone: input.phone ?? "",
    email: input.email ?? "",
    prefersPhone: input.contactPreference === "PHONE",
    contactLine:
      input.contactPreference === "PHONE"
        ? `Woli telefon: ${input.phone ?? "brak numeru"}`
        : `Woli e-mail: ${input.email ?? "brak adresu"}`,
    objectName: input.objectName ?? "",
    address: input.address,
    objectType: input.objectType ? LEAD_OBJECT_TYPE_LABEL[input.objectType] : "nie podał",
    spots: input.spots,
    spotsLabel: formatSpots(input.spots),
    ownerKind: input.ownerKind === "BUSINESS" ? "Firma" : "Osoba prywatna",
    // "ok." because these are straight-line minutes with a detour factor, not a
    // pedestrian route (CLAUDE.md).
    walkEnea: estimate.walkMinutesEnea === null ? "" : `ok. ${estimate.walkMinutesEnea} min`,
    walkMtp: estimate.walkMinutesMtp === null ? "" : `ok. ${estimate.walkMinutesMtp} min`,
    // A string so that a real 0 ("nothing in reach") still shows under {{#if}};
    // "" means the address was never placed on the map, so there is no estimate.
    eventsInReach: estimate.eventsInReach === null ? "" : String(estimate.eventsInReach),
    estimatedRate: estimate.estimatedRateGr === null ? "" : formatMoney(estimate.estimatedRateGr),
    estimatedAnnual:
      estimate.estimatedAnnualGrossGr === null ? "" : formatMoney(estimate.estimatedAnnualGrossGr),
    consentsLine: `e-mail: ${input.marketingEmailConsent ? "tak" : "nie"} · telefon: ${
      input.marketingPhoneConsent ? "tak" : "nie"
    }`,
    // Which page and campaign link brought them, e.g. "dla-wlascicieli?z=mail".
    source: input.source ?? "",
    ctaUrl: `${appUrl}/admin/leady`,
    ctaLabel: "Otwórz panel leadów",
  };

  try {
    const sent = await getEmailProvider().send({
      to,
      template: "owner-lead",
      data,
      idempotencyKey: `owner-lead:${leadId}`,
    });

    if (!sent.ok) {
      // Reason only — the payload carries someone else's name, phone and address
      // and must not land in a log (CLAUDE.md).
      console.warn(`[leads] lead alert not sent for ${leadId}: ${sent.reason}`);
    }
  } catch (error) {
    // getEmailProvider() throws on a misconfigured environment (pbdevs without a
    // key). That is our problem, not the lead's.
    console.warn(
      `[leads] lead alert failed for ${leadId}: ${error instanceof Error ? error.message : "unknown"}`,
    );
  }
}
