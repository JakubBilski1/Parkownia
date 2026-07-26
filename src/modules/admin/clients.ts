import { randomInt } from "node:crypto";
import { and, desc, eq, gt, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  actionTokens,
  bookings,
  businessProfiles,
  parkings,
  userRoles,
  users,
} from "@/db/schema";
import { tstz } from "@/db/time";
import { revokeAllUserRefreshTokens } from "@/modules/auth/refresh";
import { hashPassword } from "@/modules/auth/password";
import { emailTaken, invalidState, notFound } from "./errors";
import { decodeCursor, toPage, type Page } from "./pagination";
import {
  clientIdSchema,
  clientsQuerySchema,
  createClientSchema,
  createEmployeeSchema,
  employeeIdSchema,
  updateClientSchema,
} from "./schemas";

/**
 * Clients — the parties we have a contract with — and the staff accounts that act
 * for them. Everything here is admin-only: self-service sign-up is off, so this
 * module is the ONLY way an account comes into existence outside the (also
 * admin-gated) register endpoint.
 *
 * Deliberately NOT reusing auth's register(): registerSchema demands consents,
 * and an admin ticking a consent box on somebody else's behalf is not consent.
 * A client account rests on the contract we signed with them (RODO art. 6 ust. 1
 * lit. b), so no consent row is fabricated in their name. When the terms need
 * accepting in-app, that is a gate on first login — not a checkbox an operator
 * ticks for a stranger.
 */

export type ClientListItem = {
  id: string;
  createdAt: Date;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  companyName: string | null;
  nip: string | null;
  isBusiness: boolean;
  deletedAt: Date | null;
  parkingCount: number;
  employeeCount: number;
  payoutsEnabled: boolean;
};

const parkingCountSql = sql<number>`(
  SELECT count(*)::int FROM ${parkings} WHERE ${parkings.ownerId} = ${users.id}
)`;

// Aliasing users to itself inside a correlated subquery, so the count is "staff of
// this row" and not "staff of anybody".
const employeeCountSql = sql<number>`(
  SELECT count(*)::int FROM users staff
  WHERE staff.employer_id = ${users.id} AND staff.deleted_at IS NULL
)`;

const CLIENT_ROLES = ["HOST_INDIVIDUAL", "HOST_BUSINESS"] as const;

const LIST_COLUMNS = {
  id: users.id,
  createdAt: users.createdAt,
  email: users.email,
  firstName: users.firstName,
  lastName: users.lastName,
  phone: users.phone,
  companyName: businessProfiles.companyName,
  nip: businessProfiles.nip,
  deletedAt: users.deletedAt,
  payoutsEnabled: users.payoutsEnabled,
  parkingCount: parkingCountSql,
  employeeCount: employeeCountSql,
} as const;

/** Newest first: the client an admin just created is the one they want to see. */
export async function listClients(input: unknown): Promise<Page<ClientListItem>> {
  const { q, kind, includeDeleted, limit, cursor: rawCursor } = clientsQuerySchema.parse(input);
  const cursor = decodeCursor(rawCursor);

  const rows = await db
    .selectDistinct(LIST_COLUMNS)
    .from(users)
    .innerJoin(
      userRoles,
      and(
        eq(userRoles.userId, users.id),
        kind
          ? eq(userRoles.role, kind === "BUSINESS" ? "HOST_BUSINESS" : "HOST_INDIVIDUAL")
          : inArray(userRoles.role, [...CLIENT_ROLES]),
      ),
    )
    .leftJoin(businessProfiles, eq(businessProfiles.userId, users.id))
    .where(
      and(
        // A client acts for themselves. Staff accounts belong to their client's page.
        isNull(users.employerId),
        includeDeleted ? undefined : isNull(users.deletedAt),
        q ? matches(q) : undefined,
        cursor
          ? sql`(${users.createdAt}, ${users.id}) < (${tstz(cursor.createdAt)}, ${cursor.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(limit + 1);

  const page = toPage(rows, limit);

  return {
    ...page,
    items: page.items.map((row) => ({ ...row, isBusiness: row.nip !== null })),
  };
}

function matches(q: string) {
  const pattern = `%${q}%`;
  return or(
    sql`${users.email}::text ILIKE ${pattern}`,
    sql`coalesce(${users.firstName}, '') ILIKE ${pattern}`,
    sql`coalesce(${users.lastName}, '') ILIKE ${pattern}`,
    sql`coalesce(${businessProfiles.companyName}, '') ILIKE ${pattern}`,
    sql`regexp_replace(coalesce(${users.phone}, ''), '\\D', '', 'g') ILIKE ${`%${q.replace(/\D/g, "")}%`}`,
  );
}

export type EmployeeRow = {
  id: string;
  createdAt: Date;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  deletedAt: Date | null;
};

export type ClientDetail = ClientListItem & {
  roles: string[];
  employees: EmployeeRow[];
};

export async function getClient(input: unknown): Promise<ClientDetail> {
  const { clientId } = clientIdSchema.parse(input);

  const [row] = await db
    .select(LIST_COLUMNS)
    .from(users)
    .leftJoin(businessProfiles, eq(businessProfiles.userId, users.id))
    .where(and(eq(users.id, clientId), isNull(users.employerId)))
    .limit(1);

  if (!row) throw notFound("Klient");

  const roleRows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, clientId));

  const employees = await db
    .select({
      id: users.id,
      createdAt: users.createdAt,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(and(eq(users.employerId, clientId), isNull(users.deletedAt)))
    .orderBy(desc(users.createdAt));

  return {
    ...row,
    isBusiness: row.nip !== null,
    roles: roleRows.map((r) => r.role),
    employees,
  };
}

/* -------------------------------------------------------------------------- */
/* Creating accounts                                                          */
/* -------------------------------------------------------------------------- */

/**
 * A password the admin can read down the phone without spelling every character:
 * no look-alikes (0/O, 1/l/I), four blocks of four. ~62 bits of entropy from
 * crypto.randomInt, which is plenty for a credential that gets changed on first
 * use — and unlike a mail invite, it works today: production has no mail provider
 * configured yet, so an invite link would simply never arrive.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateTempPassword(): string {
  const blocks: string[] = [];
  for (let b = 0; b < 4; b += 1) {
    let block = "";
    for (let i = 0; i < 4; i += 1) block += ALPHABET[randomInt(ALPHABET.length)];
    blocks.push(block);
  }
  return blocks.join("-");
}

export type CreatedAccount = {
  id: string;
  email: string;
  /** Shown to the operator ONCE. Never stored, never logged, never mailed. */
  tempPassword: string;
};

async function assertEmailFree(email: string): Promise<void> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Includes soft-deleted rows on purpose: their e-mail is rewritten on deletion,
  // so a hit here is a live account, and the unique index would refuse anyway.
  if (existing) throw emailTaken();
}

export async function createClient(input: unknown): Promise<CreatedAccount> {
  const data = createClientSchema.parse(input);
  await assertEmailFree(data.email);

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const id = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({
        email: data.email,
        passwordHash,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        phone: data.phone ?? null,
      })
      .returning({ id: users.id });

    if (!created) throw new Error("Failed to insert client.");

    // DRIVER as well: a client who wants to test the purchase path on their own
    // parking should not need a second account for it.
    await tx.insert(userRoles).values([
      { userId: created.id, role: data.kind === "BUSINESS" ? "HOST_BUSINESS" : "HOST_INDIVIDUAL" },
      { userId: created.id, role: "DRIVER" },
    ]);

    if (data.kind === "BUSINESS") {
      await tx.insert(businessProfiles).values({
        userId: created.id,
        // The schema guarantees both on BUSINESS.
        nip: data.nip!,
        companyName: data.companyName!,
        address: data.address ?? null,
      });
    }

    return created.id;
  });

  return { id, email: data.email, tempPassword };
}

export async function createEmployee(input: unknown): Promise<CreatedAccount> {
  const data = createEmployeeSchema.parse(input);

  const [client] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, data.clientId), isNull(users.employerId), isNull(users.deletedAt)))
    .limit(1);

  if (!client) throw notFound("Klient");

  await assertEmailFree(data.email);

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const id = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({
        email: data.email,
        passwordHash,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        phone: data.phone ?? null,
        employerId: data.clientId,
      })
      .returning({ id: users.id });

    if (!created) throw new Error("Failed to insert employee.");

    // HOST_EMPLOYEE only — no DRIVER. A gate account is for the gate; if the
    // person also wants to buy parking, that is their own private account.
    await tx.insert(userRoles).values({ userId: created.id, role: "HOST_EMPLOYEE" });

    return created.id;
  });

  return { id, email: data.email, tempPassword };
}

/* -------------------------------------------------------------------------- */
/* Editing                                                                    */
/* -------------------------------------------------------------------------- */

export async function updateClient(input: unknown): Promise<{ id: string }> {
  const data = updateClientSchema.parse(input);

  const [client] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, data.clientId), isNull(users.employerId), isNull(users.deletedAt)))
    .limit(1);

  if (!client) throw notFound("Klient");

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
        ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
        // An empty phone field means "clear it"; an untouched one means "leave it".
        ...(data.clearPhone ? { phone: null } : data.phone !== undefined ? { phone: data.phone } : {}),
        updatedAt: sql`now()`,
      })
      .where(eq(users.id, data.clientId));

    if (data.companyName !== undefined || data.address !== undefined) {
      // Only touches an existing profile: creating one would need a NIP, and the
      // edit form does not ask for one (it is on the invoice, not a nickname).
      await tx
        .update(businessProfiles)
        .set({
          ...(data.companyName !== undefined ? { companyName: data.companyName } : {}),
          ...(data.address !== undefined ? { address: data.address } : {}),
          updatedAt: sql`now()`,
        })
        .where(eq(businessProfiles.userId, data.clientId));
    }
  });

  return { id: data.clientId };
}

/**
 * A new temporary password, for the call that starts with "I cannot log in".
 * Every session of that account dies with it, which is the point: if the reason
 * they cannot log in is that somebody else can, a fresh password with the old
 * sessions still alive fixes nothing.
 */
export async function resetAccountPassword(input: unknown): Promise<CreatedAccount> {
  const { clientId } = clientIdSchema.parse(input);

  const [account] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(eq(users.id, clientId), isNull(users.deletedAt)))
    .limit(1);

  if (!account) throw notFound("Konto");

  const tempPassword = generateTempPassword();

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(tempPassword), updatedAt: sql`now()` })
    .where(eq(users.id, account.id));

  await revokeAllUserRefreshTokens(account.id);

  return { id: account.id, email: account.email, tempPassword };
}

/* -------------------------------------------------------------------------- */
/* Removing                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Soft delete, and anonymisation with it — the same shape as the self-service
 * deletion on /konto (modules/users/service.ts). Bookings, payments and
 * commissions survive because accounting and DAC7 need them; the person does not
 * survive in them.
 *
 * A live booking blocks the deletion. Removing a client whose driver arrives
 * tomorrow would leave a paid ticket pointing at a gate nobody answers.
 */
export async function softDeleteClient(input: unknown): Promise<{ id: string }> {
  const { clientId } = clientIdSchema.parse(input);

  const [client] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, clientId), isNull(users.employerId), isNull(users.deletedAt)))
    .limit(1);

  if (!client) throw notFound("Klient");

  const [live] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .innerJoin(parkings, eq(parkings.id, bookings.parkingId))
    .where(
      and(
        eq(parkings.ownerId, clientId),
        inArray(bookings.status, ["PENDING", "CONFIRMED"]),
        gt(bookings.endsAt, new Date()),
      ),
    )
    .limit(1);

  if (live) {
    throw invalidState(
      "Ten klient ma rezerwację, która jeszcze się nie zakończyła. Poczekaj albo ją anuluj i zwróć pieniądze, potem usuń klienta.",
    );
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    const staff = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.employerId, clientId), isNull(users.deletedAt)));

    await tx
      .update(users)
      .set({
        email: sql`concat('deleted-', ${users.id}::text, '@anonymized.local')`,
        phone: null,
        firstName: null,
        lastName: null,
        passwordHash: null,
        deletedAt: now,
        updatedAt: now,
      })
      // The client and every staff account in one statement: an employee whose
      // client is gone has nothing to scan, and leaving their login alive is an
      // open door into a closed contract.
      .where(or(eq(users.id, clientId), eq(users.employerId, clientId)));

    // Parkings stay — bookings point at them — but they leave the market and are
    // flagged, so nobody chases an owner who no longer exists.
    await tx
      .update(parkings)
      .set({ status: "PAUSED", deletedOwner: true, updatedAt: now })
      .where(eq(parkings.ownerId, clientId));

    // Any live "set your password" link would resurrect access.
    const ids = [clientId, ...staff.map((s) => s.id)];
    await tx
      .update(actionTokens)
      .set({ usedAt: now, updatedAt: now })
      .where(and(inArray(actionTokens.userId, ids), isNull(actionTokens.usedAt)));

    for (const id of ids) {
      await tx
        .update(businessProfiles)
        .set({ address: null, updatedAt: now })
        .where(eq(businessProfiles.userId, id));
    }
  });

  await revokeAllUserRefreshTokens(clientId);

  const staff = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.employerId, clientId), isNotNull(users.deletedAt)));

  for (const member of staff) {
    await revokeAllUserRefreshTokens(member.id);
  }

  return { id: clientId };
}

/** Same treatment for one staff account: the client stays, the login does not. */
export async function softDeleteEmployee(input: unknown): Promise<{ id: string }> {
  const { employeeId } = employeeIdSchema.parse(input);

  const [employee] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, employeeId), isNotNull(users.employerId), isNull(users.deletedAt)))
    .limit(1);

  if (!employee) throw notFound("Pracownik");

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        email: sql`concat('deleted-', ${users.id}::text, '@anonymized.local')`,
        phone: null,
        firstName: null,
        lastName: null,
        passwordHash: null,
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, employeeId));

    await tx
      .update(actionTokens)
      .set({ usedAt: now, updatedAt: now })
      .where(and(eq(actionTokens.userId, employeeId), isNull(actionTokens.usedAt)));
  });

  await revokeAllUserRefreshTokens(employeeId);

  return { id: employeeId };
}
