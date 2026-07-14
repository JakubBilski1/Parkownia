import { cookies, headers } from "next/headers";
import type { Role } from "@/db/types";
import { ACCESS_COOKIE } from "@/modules/auth/cookie-names";
import { verifyAccessToken, type AccessTokenClaims } from "@/modules/auth/jwt";
import { forbidden, unauthorized } from "./api";

/**
 * Server-side session, read from the access token — no database round-trip.
 * That is the trade the 15-minute lifetime buys: a role revoked mid-window is
 * only felt on the next refresh. Anything that must be exact right now (does
 * this host still own this parking?) is checked against the database at the
 * point of use, not here.
 *
 * This is the ONLY place in the codebase that turns a request into an identity.
 * The parkings, admin and scan modules used to each verify the JWT themselves —
 * and two of them read a cookie name that auth never sets, so every host page
 * and the whole admin panel saw a logged-in user as anonymous.
 */
export type SessionUser = AccessTokenClaims;

function bearerFrom(header: string | null | undefined): string | null {
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
}

/**
 * Both transports the contract promises (docs/API_SPEC.md §"Zasady globalne"):
 * `Authorization: Bearer …` or the httpOnly cookie. Passing the Request is
 * optional — without it the incoming headers are read from the async store, so
 * RSC pages and server actions authenticate the same way route handlers do.
 */
export async function getSession(req?: Request): Promise<SessionUser | null> {
  const explicit = bearerFrom(req?.headers.get("authorization"));
  if (explicit) return verifyAccessToken(explicit);

  if (!req) {
    const headerBag = await headers();
    const ambient = bearerFrom(headerBag.get("authorization"));
    if (ambient) return verifyAccessToken(ambient);
  }

  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  return verifyAccessToken(token);
}

export async function requireUser(req?: Request): Promise<SessionUser> {
  const session = await getSession(req);
  if (!session) {
    throw unauthorized();
  }
  return session;
}

export async function requireRole(role: Role, req?: Request): Promise<SessionUser> {
  const session = await requireUser(req);
  if (!session.roles.includes(role)) {
    throw forbidden();
  }
  return session;
}

export function isHost(session: SessionUser): boolean {
  return session.roles.includes("HOST_INDIVIDUAL") || session.roles.includes("HOST_BUSINESS");
}
