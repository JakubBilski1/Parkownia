import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession, isHost } from "@/lib/session";
import type { SessionUser } from "./user-menu";

/**
 * The nav needs a name to greet and a role to branch on; the access token carries
 * neither (it holds no personal data, on purpose — src/modules/auth/jwt.ts). So the
 * display name is fetched here, once per page render.
 *
 * Nothing passed this before integration, which meant the header rendered "log in"
 * to people who were already logged in, on every page in the app.
 */
export async function getNavUser(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session) return null;

  const [row] = await db
    .select({ email: users.email, firstName: users.firstName })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!row) return null;

  return {
    email: row.email,
    firstName: row.firstName,
    isHost: isHost(session),
  };
}
