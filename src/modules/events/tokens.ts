import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { actionTokens } from "@/db/schema";
import { hashActionToken, issueActionToken } from "@/modules/auth/action-tokens";

/**
 * The auth module owns issuing and burning of `action_tokens`
 * (src/modules/auth/action-tokens.ts) — this file adds only what the events flow
 * needs on top: a *read-only* peek at an EVENT_AVAILABILITY token, so that opening
 * the link from the e-mail does not spend it. The token is spent when the host
 * presses a button, not when their mail client prefetches the URL.
 */

export type EventAvailabilityPayload = {
  eventId: string;
  parkingId: string;
  /** What the two buttons will offer: "Tak, N miejsc po X zł". Computed server-side. */
  spots: number;
  priceGr: number;
};

export type TokenFailure = "TOKEN_INVALID" | "TOKEN_USED" | "TOKEN_EXPIRED";

export type TokenPeek =
  | { ok: true; userId: string; payload: EventAvailabilityPayload }
  | { ok: false; reason: TokenFailure };

export function isEventAvailabilityPayload(value: unknown): value is EventAvailabilityPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.eventId === "string" &&
    typeof candidate.parkingId === "string" &&
    typeof candidate.spots === "number" &&
    typeof candidate.priceGr === "number"
  );
}

export async function issueEventAvailabilityToken(input: {
  userId: string;
  /** The link dies with the event: an offer to open a parking for a match already played is noise. */
  expiresAt: Date;
  payload: EventAvailabilityPayload;
}): Promise<string> {
  const issued = await issueActionToken({
    userId: input.userId,
    purpose: "EVENT_AVAILABILITY",
    payload: input.payload,
    expiresAt: input.expiresAt,
  });

  return issued.token;
}

export async function peekEventAvailabilityToken(token: string): Promise<TokenPeek> {
  const [row] = await db
    .select({
      userId: actionTokens.userId,
      payload: actionTokens.payload,
      expiresAt: actionTokens.expiresAt,
      usedAt: actionTokens.usedAt,
    })
    .from(actionTokens)
    .where(
      and(
        eq(actionTokens.tokenHash, hashActionToken(token)),
        eq(actionTokens.purpose, "EVENT_AVAILABILITY"),
      ),
    )
    .limit(1);

  if (!row || !isEventAvailabilityPayload(row.payload)) {
    return { ok: false, reason: "TOKEN_INVALID" };
  }
  if (row.usedAt) {
    return { ok: false, reason: "TOKEN_USED" };
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "TOKEN_EXPIRED" };
  }

  return { ok: true, userId: row.userId, payload: row.payload };
}
