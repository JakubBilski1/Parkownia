import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { userRoles, users } from "@/db/schema";
import { getSession, isHost } from "@/lib/session";
import type { SessionUser } from "./user-menu";

/**
 * The nav needs a name to greet and a role to branch on; the access token carries
 * neither (it holds no personal data, on purpose — src/modules/auth/jwt.ts). So the
 * display name is fetched here, once per page render.
 *
 * Nothing passed this before integration, which meant the header rendered "log in"
 * to people who were already logged in, on every page in the app.
 *
 * `isAdmin` comes from the database, not from the token, for the same reason the
 * panel's own gate does (modules/admin/session.ts): a role granted a minute ago
 * has to light up the menu now, and a role revoked a minute ago has to stop
 * advertising a panel the user can no longer open. It was missing entirely until
 * it was reported — the type declared it, UserMenu branched on it, and nobody
 * ever set it, so "Panel admina" had never once been rendered.
 *
 * A database hiccup must not turn every page into a 500 — a visitor we cannot
 * identify is treated as a visitor. The cookie read stays OUTSIDE that guard on
 * purpose: reading cookies is how Next learns the route cannot be static, and it
 * signals that by throwing. Swallowing it would hand Next a page rendered as
 * "logged out" and let it cache that — the very bug this function exists to
 * prevent, baked in at build time.
 */
export async function getNavUser(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session) return null;

  try {
    const [row] = await db
      .select({ email: users.email, firstName: users.firstName })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!row) return null;

    const [adminRole] = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(and(eq(userRoles.userId, session.userId), eq(userRoles.role, "ADMIN")))
      .limit(1);

    return {
      email: row.email,
      firstName: row.firstName,
      isHost: isHost(session),
      isAdmin: Boolean(adminRole),
      isEmployee: session.roles.includes("HOST_EMPLOYEE"),
    };
  } catch (error) {
    console.error("[nav] user lookup failed:", error instanceof Error ? error.message : error);
    return null;
  }
}
