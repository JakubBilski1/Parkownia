// Subpath imports, not the `jose` barrel. The barrel re-exports JWE, whose
// decrypt path pulls in CompressionStream/DecompressionStream — Node APIs that
// do not exist on the Edge runtime. Middleware imports verifyAccessToken, so the
// barrel dragged that dead code into the Edge bundle and made `next build` warn
// on every run. We only ever sign and verify JWS (HS256); these are the two
// entry points that do it.
import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import type { Role } from "@/db/types";

/**
 * Access token: 15 minutes, HS256, carries only `sub` and roles.
 * No e-mail, no name — the token travels in a cookie and in logs of every proxy
 * on the way; it must not carry personal data.
 *
 * jose (not jsonwebtoken) because middleware runs on the Edge runtime, where
 * node:crypto is not available.
 */

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export type AccessTokenClaims = {
  userId: string;
  roles: Role[];
};

const encoder = new TextEncoder();

function accessSecret(): Uint8Array {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is not set.");
  }
  return encoder.encode(secret);
}

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  return new SignJWT({ roles: claims.roles })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setIssuer("parkownia")
    .setAudience("parkownia")
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(accessSecret());
}

/** Returns null for any invalid, expired or malformed token — never throws. */
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, accessSecret(), {
      issuer: "parkownia",
      audience: "parkownia",
    });

    if (!payload.sub) return null;

    const roles = Array.isArray(payload.roles) ? (payload.roles as Role[]) : [];
    return { userId: payload.sub, roles };
  } catch {
    return null;
  }
}
