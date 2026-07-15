import { sendNotification } from "@/modules/notifications";

/**
 * The two transactional mails auth owns — the password-reset link and the
 * data-export link — sent through the notifications module (the pbdevs mail API
 * renders the template; notification_log dedupes). It still logs no recipient,
 * because e-mail addresses are personal data.
 *
 * `tokenId` (not `userId`) is the dedup key: keyed on the user, a second
 * password reset would collide with the first row in notification_log and never
 * leave the building.
 */
export type ActionMailTemplate = "password_reset" | "data_export";

export type ActionMail = {
  userId: string;
  to: string;
  template: ActionMailTemplate;
  /** Row id in `action_tokens` — the notification's relatedId. */
  tokenId: string;
  /** The single-use token itself; the template builds the link from it. */
  token: string;
  expiresAt: Date;
  firstName?: string | null;
};

const PASSWORD_RESET_TTL_MINUTES = 60;

export async function sendActionLink(mail: ActionMail): Promise<void> {
  if (mail.template === "password_reset") {
    await sendNotification({
      template: "password-reset",
      recipient: { userId: mail.userId, email: mail.to, phone: null },
      relatedId: mail.tokenId,
      payload: {
        firstName: mail.firstName,
        actionToken: mail.token,
        expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
      },
    });
    return;
  }

  await sendNotification({
    template: "data-export",
    recipient: { userId: mail.userId, email: mail.to, phone: null },
    relatedId: mail.tokenId,
    payload: {
      firstName: mail.firstName,
      actionToken: mail.token,
      expiresAt: mail.expiresAt.toISOString(),
    },
  });
}

export function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return new URL(path, base).toString();
}
