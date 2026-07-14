import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { userRoles, users } from "@/db/schema";
import { getSession } from "@/lib/session";
import { forbidden, unauthenticated } from "./errors";

/**
 * The token is verified by @/lib/session — one verifier, one cookie name. What
 * stays here is what is specific to this panel: the ADMIN role is read from the
 * database, never from the token, so an admin demoted a minute ago does not keep
 * a working panel for the token's remaining 15 minutes.
 */
export type AdminSession = {
  userId: string;
  email: string;
};

/** Null when nobody is logged in or the caller is not an admin — never throws. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const session = await getSession();
  if (!session) return null;

  const [row] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.role, "ADMIN")))
    .where(and(eq(users.id, session.userId), isNull(users.deletedAt)))
    .limit(1);

  if (!row) return null;
  return { userId: row.id, email: row.email };
}

/** Every admin endpoint, server action and page starts here. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getSession();
  if (!session) throw unauthenticated();

  const admin = await getAdminSession();
  if (!admin) throw forbidden();
  return admin;
}
