import { createHmac, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { actionTokens } from "@/db/schema";
import type { ActionTokenPurpose } from "@/db/types";
import { invalidInput } from "@/lib/api";

/**
 * One-shot tokens behind e-mail links: host availability declaration, e-mail
 * verification, password reset, data export (docs/DATA_MODEL.md §8).
 *
 * Same rule as refresh tokens: random secret out, HMAC in the database. A token
 * is bound to a purpose — a data-export link cannot be replayed against the
 * password-reset endpoint.
 */

export const ACTION_TOKEN_TTL_SECONDS: Record<ActionTokenPurpose, number> = {
  EVENT_AVAILABILITY: 30 * 24 * 60 * 60,
  EMAIL_VERIFY: 7 * 24 * 60 * 60,
  PASSWORD_RESET: 60 * 60,
  DATA_EXPORT: 24 * 60 * 60,
};

function actionSecret(): string {
  const secret = process.env.ACTION_TOKEN_SECRET;
  if (!secret) {
    throw new Error("ACTION_TOKEN_SECRET is not set.");
  }
  return secret;
}

export function hashActionToken(token: string): string {
  return createHmac("sha256", actionSecret()).update(token).digest("hex");
}

export type IssuedActionToken = {
  /** Row id in `action_tokens`. Notifications dedupe on it: keyed on the user
   *  instead, a second password-reset mail would be silently swallowed. */
  id: string;
  token: string;
  expiresAt: Date;
};

export async function issueActionToken(input: {
  userId: string;
  purpose: ActionTokenPurpose;
  payload?: Record<string, unknown>;
  /** Overrides the default TTL for this purpose (e.g. a link valid until an event). */
  expiresAt?: Date;
}): Promise<IssuedActionToken> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt =
    input.expiresAt ??
    new Date(Date.now() + ACTION_TOKEN_TTL_SECONDS[input.purpose] * 1000);

  const [row] = await db
    .insert(actionTokens)
    .values({
      userId: input.userId,
      purpose: input.purpose,
      tokenHash: hashActionToken(token),
      payload: input.payload ?? null,
      expiresAt,
    })
    .returning({ id: actionTokens.id });

  if (!row) {
    throw new Error("action_tokens INSERT returned no row");
  }

  return { id: row.id, token, expiresAt };
}

export type ConsumedActionToken = {
  userId: string;
  payload: Record<string, unknown> | null;
};

/**
 * Verifies and burns the token in one locked transaction — two clicks on the
 * same link from the same mail must not both go through.
 */
export async function consumeActionToken(
  purpose: ActionTokenPurpose,
  rawToken: string,
): Promise<ConsumedActionToken> {
  const tokenHash = hashActionToken(rawToken);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(actionTokens)
      .where(eq(actionTokens.tokenHash, tokenHash))
      .for("update");

    const expired = row ? row.expiresAt.getTime() <= Date.now() : true;

    if (!row || row.purpose !== purpose || row.usedAt || expired) {
      throw invalidInput(
        "Ten link jest nieaktualny lub został już użyty. Poproś o nowy.",
        "TOKEN_INVALID",
      );
    }

    const now = new Date();
    await tx
      .update(actionTokens)
      .set({ usedAt: now, updatedAt: now })
      .where(eq(actionTokens.id, row.id));

    return { userId: row.userId, payload: row.payload ?? null };
  });
}
