import { forbidden, unauthorized } from "@/lib/api";
import { getSession, isHost, type SessionUser } from "@/lib/session";

/**
 * Who may work a gate: a host, or an admin standing in for one during an
 * incident. Everything else the scanner needs to know about ownership is
 * checked against the database at the point of use — a parking that changed
 * hands mid-token must not be scannable on a stale claim.
 */
export function canScan(session: SessionUser): boolean {
  return isHost(session) || session.roles.includes("ADMIN");
}

/** API routes: throws 401/403, which @/lib/api maps to the standard error shape. */
export async function requireScanner(req?: Request): Promise<SessionUser> {
  const session = await getSession(req);
  if (!session) throw unauthorized();
  if (!canScan(session)) {
    throw forbidden("Skaner jest dla hostów. To konto nie ma parkingu.");
  }
  return session;
}

/** Pages: no throw — the screen explains itself instead of blowing up. */
export async function getHostSession(): Promise<SessionUser | null> {
  const session = await getSession();
  return session && canScan(session) ? session : null;
}
