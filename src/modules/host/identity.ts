import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Whose parkings is this account working with?
 *
 * A client acts for themselves. An employee (users.employer_id, role
 * HOST_EMPLOYEE) acts for the client who employs them — parkings, bookings and
 * codes all belong to that client, never to the employee. Every host-side read
 * has to go through here, or a gate attendant opens the scanner and sees an empty
 * list because they own no parking of their own.
 *
 * Read from the database, not from the token, for the same reason the ADMIN role
 * is (modules/admin/session.ts): staff get removed, and a 15-minute access token
 * must not keep a dismissed employee scanning at the gate.
 *
 * Returns null when the employment no longer resolves — the employer row is gone
 * or soft-deleted. Callers must treat that as no access, not as "act for
 * yourself": falling back to the employee's own id would be a silent downgrade
 * that shows an empty screen instead of saying what happened.
 */
export async function resolveHostId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ employerId: users.employerId })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  if (!row) return null;
  if (!row.employerId) return userId;

  const [employer] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, row.employerId), isNull(users.deletedAt)))
    .limit(1);

  return employer?.id ?? null;
}
