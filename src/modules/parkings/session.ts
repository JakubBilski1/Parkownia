import { getSession as readSession, isHost, type SessionUser } from "@/lib/session";
import { ApiError } from "./errors";

/**
 * Policy only. Verifying the token, knowing the cookie name and reading the
 * Authorization header all live in @/lib/session — this file only decides who is
 * allowed to touch a parking, and in which words we say no.
 */
export type Session = SessionUser;

export async function getSession(request?: Request): Promise<Session | null> {
  return readSession(request);
}

export async function requireSession(request?: Request): Promise<Session> {
  const session = await getSession(request);
  if (!session) {
    throw new ApiError("UNAUTHORIZED", "Zaloguj się, aby kontynuować.");
  }
  return session;
}

export async function requireHost(request?: Request): Promise<Session> {
  const session = await requireSession(request);
  if (!isHost(session)) {
    throw new ApiError(
      "FORBIDDEN",
      "To konto nie udostępnia jeszcze parkingów. Dodaj rolę hosta w ustawieniach konta.",
    );
  }
  return session;
}

export function isBusinessHost(session: Session): boolean {
  return session.roles.includes("HOST_BUSINESS");
}
