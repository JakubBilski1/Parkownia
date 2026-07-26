import { forbidden, unauthorized } from "@/lib/api";
import { getSession, isHost, type SessionUser } from "@/lib/session";
import { resolveHostId } from "@/modules/host/identity";

/**
 * Who may work a gate: a client, an employee of one, or an admin standing in for
 * one during an incident. Everything else the scanner needs to know about
 * ownership is checked against the database at the point of use — a parking that
 * changed hands mid-token must not be scannable on a stale claim.
 */
export function canScan(session: SessionUser): boolean {
  return (
    isHost(session) || session.roles.includes("HOST_EMPLOYEE") || session.roles.includes("ADMIN")
  );
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

/**
 * The session plus the id whose parkings it works with. An employee owns nothing
 * under their own id, so every scan and every booking list is keyed on the client
 * — see resolveHostId(). Never hand `session.userId` to the scan module directly.
 */
export type ScanContext = {
  session: SessionUser;
  hostId: string;
};

export async function requireScanContext(req?: Request): Promise<ScanContext> {
  const session = await requireScanner(req);
  const hostId = await resolveHostId(session.userId);

  if (!hostId) {
    throw forbidden(
      "To konto pracownicze nie jest już przypisane do klienta. Poproś administratora o dostęp.",
    );
  }

  return { session, hostId };
}

/** Pages: no throw — the screen explains itself instead of blowing up. */
export async function getHostSession(): Promise<SessionUser | null> {
  const session = await getSession();
  return session && canScan(session) ? session : null;
}

/** Pages that also need the client's id. Null when there is no usable access. */
export async function getScanContext(): Promise<ScanContext | null> {
  const session = await getHostSession();
  if (!session) return null;

  const hostId = await resolveHostId(session.userId);
  return hostId ? { session, hostId } : null;
}
