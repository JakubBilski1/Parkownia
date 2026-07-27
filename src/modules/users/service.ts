import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  actionTokens,
  bookings,
  businessProfiles,
  notificationLog,
  parkings,
  payments,
  users,
  userRoles,
} from "@/db/schema";
import { conflict, notFound } from "@/lib/api";
import { revokeAllUserRefreshTokens } from "@/modules/auth/refresh";
import { listConsents } from "./consents";
import type { UpdateProfileInput } from "./schemas";

export type UserProfile = {
  id: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  emailVerifiedAt: Date | null;
  roles: string[];
  createdAt: Date;
};

export async function getProfile(userId: string): Promise<UserProfile> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || user.deletedAt) {
    throw notFound("Nie znaleźliśmy tego konta.");
  }

  const roles = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));

  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    emailVerifiedAt: user.emailVerifiedAt,
    roles: roles.map((row) => row.role),
    createdAt: user.createdAt,
  };
}

/**
 * RODO art. 16 — rectification. Only the fields the user actually sent are
 * touched: `undefined` means "left alone", `null` means "clear it". Without that
 * distinction a form that submits three inputs would wipe the two the user never
 * opened.
 *
 * An anonymised account is not editable — `deletedAt` stays in the WHERE so a
 * deletion cannot be undone one field at a time.
 */
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<UserProfile> {
  const patch = {
    ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
    ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
  };

  const [row] = await db
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .returning({ id: users.id });

  if (!row) {
    throw notFound("Nie znaleźliśmy tego konta.");
  }

  return getProfile(userId);
}

/**
 * RODO art. 20 — everything we hold about this person, in one JSON.
 * Bookings and payments are included: they are that person's transaction
 * history, and they are exactly what the export exists for.
 */
export async function exportUserData(userId: string): Promise<Record<string, unknown>> {
  const profile = await getProfile(userId);

  const [business] = await db
    .select()
    .from(businessProfiles)
    .where(eq(businessProfiles.userId, userId));

  const userBookings = await db
    .select({
      booking: bookings,
      payment: payments,
    })
    .from(bookings)
    .leftJoin(payments, eq(payments.bookingId, bookings.id))
    .where(eq(bookings.userId, userId));

  const notifications = await db
    .select({
      channel: notificationLog.channel,
      template: notificationLog.template,
      sentAt: notificationLog.sentAt,
      status: notificationLog.status,
    })
    .from(notificationLog)
    .where(eq(notificationLog.userId, userId));

  const ownedParkings = await db
    .select({
      id: parkings.id,
      title: parkings.title,
      address: parkings.address,
      status: parkings.status,
      createdAt: parkings.createdAt,
    })
    .from(parkings)
    .where(eq(parkings.ownerId, userId));

  return {
    generatedAt: new Date().toISOString(),
    profile,
    businessProfile: business ?? null,
    consents: await listConsents(userId),
    parkings: ownedParkings,
    bookings: userBookings.map(({ booking, payment }) => ({
      ...booking,
      payment: payment ?? null,
    })),
    notifications,
  };
}

/**
 * Account deletion is anonymisation, not a DELETE (docs/DATA_MODEL.md §10):
 * bookings and payments have to survive for accounting, so the personal data is
 * stripped out of them instead — what is left are rows of money without a name.
 *
 * A booking that has not happened yet blocks this: the host is expecting a car,
 * the money has changed hands, and there would be nobody to refund.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const [active] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.userId, userId),
        inArray(bookings.status, ["PENDING", "CONFIRMED"]),
        gt(bookings.endsAt, new Date()),
      ),
    );

  if (active) {
    throw conflict(
      "ACTIVE_BOOKING",
      "Masz rezerwację, która jeszcze się nie zakończyła. Anuluj ją albo wykorzystaj, a potem usuń konto.",
    );
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        email: `deleted-${userId}@anonymized.local`,
        phone: null,
        firstName: null,
        lastName: null,
        passwordHash: null,
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, userId));

    // Parkings stay (bookings reference them) but leave the market, and are
    // flagged so nobody chases a host who no longer exists.
    await tx
      .update(parkings)
      .set({ status: "PAUSED", deletedOwner: true, updatedAt: now })
      .where(eq(parkings.ownerId, userId));

    // Any live "click here to reset your password" link would resurrect access
    // to an anonymised account.
    await tx
      .update(actionTokens)
      .set({ usedAt: now, updatedAt: now })
      .where(and(eq(actionTokens.userId, userId), isNull(actionTokens.usedAt)));
  });

  await revokeAllUserRefreshTokens(userId);

  // Consent rows stay: they are the proof that consent was given, and they hold
  // no personal data once the user row is anonymised.
  //
  // Not done here: deleting this host's photo objects from MinIO. That needs the
  // storage client owned by the parkings module — integration point.
}
