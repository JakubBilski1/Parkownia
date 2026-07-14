import { createHmac, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { refreshTokens } from "@/db/schema";
import { unauthorized } from "@/lib/api";
import { REFRESH_TOKEN_TTL_SECONDS } from "./jwt";

/**
 * The refresh token is an opaque 32-byte random string, not a JWT: it has to be
 * revocable, and a self-contained token is not.
 *
 * The database stores an HMAC of it, keyed with JWT_REFRESH_SECRET, never the
 * token itself. A dump of `refresh_tokens` is therefore useless without the
 * secret from the environment. HMAC rather than bcrypt/Argon2 on purpose — the
 * input is 256 bits of entropy, so there is nothing to brute-force, and refresh
 * runs on the critical path of every page load.
 */

function refreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error("JWT_REFRESH_SECRET is not set.");
  }
  return secret;
}

export function hashRefreshToken(token: string): string {
  return createHmac("sha256", refreshSecret()).update(token).digest("hex");
}

export type IssuedRefreshToken = {
  token: string;
  familyId: string;
  expiresAt: Date;
};

export async function issueRefreshToken(
  userId: string,
  familyId?: string,
): Promise<IssuedRefreshToken> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

  const [row] = await db
    .insert(refreshTokens)
    .values({
      userId,
      tokenHash: hashRefreshToken(token),
      familyId: familyId ?? crypto.randomUUID(),
      expiresAt,
    })
    .returning({ familyId: refreshTokens.familyId });

  if (!row) {
    throw new Error("Failed to persist refresh token.");
  }

  return { token, familyId: row.familyId, expiresAt };
}

export type RotationResult = {
  userId: string;
  refreshToken: string;
  refreshExpiresAt: Date;
};

/**
 * Rotation with reuse detection. A refresh token is single-use: presenting one
 * that is already used or revoked means the token was replayed — most likely
 * stolen — so the whole family (the chain descending from one login) dies and
 * everyone holding any of it is logged out.
 *
 * The row is locked FOR UPDATE: two tabs refreshing at the same millisecond
 * must not both succeed, or one of them would look like a replay to the next
 * request and take down a legitimate session.
 */
export async function rotateRefreshToken(rawToken: string): Promise<RotationResult> {
  const tokenHash = hashRefreshToken(rawToken);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .for("update");

    if (!row) {
      throw unauthorized("Sesja wygasła. Zaloguj się ponownie.");
    }

    if (row.usedAt || row.revokedAt) {
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(refreshTokens.familyId, row.familyId), isNull(refreshTokens.revokedAt)));

      throw unauthorized(
        "Ta sesja została unieważniona ze względów bezpieczeństwa. Zaloguj się ponownie.",
      );
    }

    if (row.expiresAt.getTime() <= Date.now()) {
      throw unauthorized("Sesja wygasła. Zaloguj się ponownie.");
    }

    const now = new Date();
    await tx
      .update(refreshTokens)
      .set({ usedAt: now, updatedAt: now })
      .where(eq(refreshTokens.id, row.id));

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

    await tx.insert(refreshTokens).values({
      userId: row.userId,
      tokenHash: hashRefreshToken(token),
      familyId: row.familyId,
      expiresAt,
    });

    return { userId: row.userId, refreshToken: token, refreshExpiresAt: expiresAt };
  });
}

/** Logout: kills the presented token and the family it belongs to. */
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(rawToken);
  const now = new Date();

  const [row] = await db
    .select({ familyId: refreshTokens.familyId })
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash));

  if (!row) return;

  await db
    .update(refreshTokens)
    .set({ revokedAt: now, updatedAt: now })
    .where(and(eq(refreshTokens.familyId, row.familyId), isNull(refreshTokens.revokedAt)));
}

/** Password change, account deletion: every session of this user ends now. */
export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  const now = new Date();
  await db
    .update(refreshTokens)
    .set({ revokedAt: now, updatedAt: now })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}
