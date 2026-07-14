import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businessProfiles, users, userRoles } from "@/db/schema";
import type { Role } from "@/db/types";
import { AppError, conflict, unauthorized } from "@/lib/api";
import { grantConsent } from "@/modules/users/consents";
import { consumeActionToken, issueActionToken } from "./action-tokens";
import { lookupGus } from "./gus";
import { signAccessToken } from "./jwt";
import { sendActionLink } from "./mailer";
import { burnPasswordTime, hashPassword, verifyPassword } from "./password";
import {
  issueRefreshToken,
  revokeAllUserRefreshTokens,
  revokeRefreshToken,
  rotateRefreshToken,
} from "./refresh";
import type {
  BusinessProfileInput,
  LoginInput,
  RegisterInput,
} from "./schemas";
import { lookupWhitelist, type WhitelistCompany } from "./whitelist";

export type PublicUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  roles: Role[];
};

export type Session = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
};

export async function getUserRoles(userId: string): Promise<Role[]> {
  const rows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));

  return rows.map((row) => row.role);
}

export async function getPublicUser(userId: string): Promise<PublicUser | null> {
  const [row] = await db.select().from(users).where(eq(users.id, userId));
  if (!row || row.deletedAt) return null;

  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    roles: await getUserRoles(row.id),
  };
}

async function startSession(user: {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}): Promise<Session> {
  const roles = await getUserRoles(user.id);
  const accessToken = await signAccessToken({ userId: user.id, roles });
  const refresh = await issueRefreshToken(user.id);

  return {
    user: { ...user, roles },
    accessToken,
    refreshToken: refresh.token,
    refreshExpiresAt: refresh.expiresAt,
  };
}

export async function register(input: RegisterInput): Promise<Session> {
  const user = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email));

    if (existing) {
      // Registration cannot hide that an e-mail is taken — but it must not hand
      // over an account either. Accounts created during checkout have no
      // password yet; the way in is the reset link, which only the mailbox
      // owner can open.
      throw conflict(
        "EMAIL_TAKEN",
        "Konto z tym adresem już istnieje. Zaloguj się albo ustaw hasło przez „Nie pamiętam hasła”.",
      );
    }

    const [created] = await tx
      .insert(users)
      .values({
        email: input.email,
        passwordHash: await hashPassword(input.password),
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        phone: input.phone ?? null,
      })
      .returning({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      });

    if (!created) {
      throw new Error("Failed to insert user.");
    }

    await tx.insert(userRoles).values({ userId: created.id, role: "DRIVER" });

    await grantConsent(created.id, "TERMS", tx);
    await grantConsent(created.id, "PRIVACY", tx);
    if (input.consents.marketingEmail) {
      await grantConsent(created.id, "MARKETING_EMAIL", tx);
    }
    if (input.consents.marketingSms) {
      await grantConsent(created.id, "MARKETING_SMS", tx);
    }

    return created;
  });

  return startSession(user);
}

const INVALID_CREDENTIALS = "Nieprawidłowy e-mail lub hasło.";

export async function login(input: LoginInput): Promise<Session> {
  const [user] = await db.select().from(users).where(eq(users.email, input.email));

  // Same answer and comparable cost for "no such account", "account deleted",
  // "account has no password yet" and "wrong password". Login never reveals
  // whether an e-mail is registered.
  if (!user || user.deletedAt || !user.passwordHash) {
    await burnPasswordTime(input.password);
    throw unauthorized(INVALID_CREDENTIALS);
  }

  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) {
    throw unauthorized(INVALID_CREDENTIALS);
  }

  return startSession({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  });
}

export async function logout(rawRefreshToken: string | null): Promise<void> {
  if (!rawRefreshToken) return;
  await revokeRefreshToken(rawRefreshToken);
}

export async function refreshSession(rawRefreshToken: string | null): Promise<Session> {
  if (!rawRefreshToken) {
    throw unauthorized("Sesja wygasła. Zaloguj się ponownie.");
  }

  const rotated = await rotateRefreshToken(rawRefreshToken);

  const [user] = await db.select().from(users).where(eq(users.id, rotated.userId));
  if (!user || user.deletedAt) {
    throw unauthorized("Sesja wygasła. Zaloguj się ponownie.");
  }

  const roles = await getUserRoles(user.id);
  const accessToken = await signAccessToken({ userId: user.id, roles });

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles,
    },
    accessToken,
    refreshToken: rotated.refreshToken,
    refreshExpiresAt: rotated.refreshExpiresAt,
  };
}

/**
 * Roles are a set, not a state machine: a host is still a driver. Upgrading is
 * one INSERT, never a migration of the account (docs/DATA_MODEL.md §2).
 */
export async function upgradeToHostIndividual(userId: string): Promise<Role[]> {
  await db
    .insert(userRoles)
    .values({ userId, role: "HOST_INDIVIDUAL" })
    .onConflictDoNothing();

  return getUserRoles(userId);
}

/** Always resolves — the caller answers 200 whether or not the account exists. */
export async function requestPasswordReset(email: string): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || user.deletedAt) return;

  const { id, token, expiresAt } = await issueActionToken({
    userId: user.id,
    purpose: "PASSWORD_RESET",
  });

  await sendActionLink({
    userId: user.id,
    to: user.email,
    template: "password_reset",
    tokenId: id,
    token,
    expiresAt,
    firstName: user.firstName,
  });
}

export async function confirmPasswordReset(token: string, password: string): Promise<void> {
  const { userId } = await consumeActionToken("PASSWORD_RESET", token);

  const passwordHash = await hashPassword(password);
  const now = new Date();

  await db
    .update(users)
    .set({ passwordHash, updatedAt: now })
    .where(eq(users.id, userId));

  // Whoever set the password owns the mailbox; anyone else holding a session
  // does not get to keep it.
  await revokeAllUserRefreshTokens(userId);
}

export type NipLookupResult = {
  nip: string;
  companyName: string;
  address: string | null;
  vatStatus: string | null;
  bankAccounts: string[];
  regon: string | null;
  legalForm: string | null;
  /** False when the registry answered "no such taxpayer" — fill the form by hand. */
  found: boolean;
};

export async function lookupCompanyByNip(nip: string): Promise<NipLookupResult> {
  const company = await lookupWhitelist(nip);

  if (!company) {
    return {
      nip,
      companyName: "",
      address: null,
      vatStatus: null,
      bankAccounts: [],
      regon: null,
      legalForm: null,
      found: false,
    };
  }

  const gus = await lookupGus(nip);

  return {
    nip: company.nip,
    companyName: company.companyName,
    address: company.address,
    vatStatus: company.vatStatus,
    bankAccounts: company.bankAccounts,
    regon: company.regon ?? gus?.regon ?? null,
    legalForm: gus?.legalForm ?? null,
    found: true,
  };
}

/**
 * The name and address the user sends are trusted (the registry is sometimes
 * stale, and the form is explicitly editable). The VAT status and the bank
 * accounts reported to the tax office are not: they are re-fetched here, from
 * the registry, and written only from that answer. A payout account will later
 * be checked against `whitelist_bank_accounts` — a value the client could set
 * would make that check theatre.
 */
export async function createBusinessProfile(
  userId: string,
  input: BusinessProfileInput,
): Promise<{ roles: Role[]; verified: boolean }> {
  let verified: WhitelistCompany | null = null;
  try {
    verified = await lookupWhitelist(input.nip);
  } catch (error) {
    // 503 from the registry: the profile is still created, just unverified.
    if (!(error instanceof AppError) || error.status !== 503) throw error;
  }

  const gus = verified ? await lookupGus(input.nip) : null;

  const [owner] = await db
    .select({ userId: businessProfiles.userId })
    .from(businessProfiles)
    .where(eq(businessProfiles.nip, input.nip));

  if (owner && owner.userId !== userId) {
    throw conflict(
      "NIP_TAKEN",
      "Ten NIP jest już przypisany do innego konta. Napisz do nas, jeśli to pomyłka.",
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(businessProfiles)
      .values({
        userId,
        nip: input.nip,
        companyName: input.companyName,
        address: input.address ?? verified?.address ?? null,
        vatStatus: verified?.vatStatus ?? null,
        whitelistCheckedAt: verified?.checkedAt ?? null,
        whitelistBankAccounts: verified?.bankAccounts ?? null,
        regon: verified?.regon ?? gus?.regon ?? null,
        legalForm: gus?.legalForm ?? null,
      })
      .onConflictDoUpdate({
        target: businessProfiles.userId,
        set: {
          nip: input.nip,
          companyName: input.companyName,
          address: input.address ?? verified?.address ?? null,
          vatStatus: verified?.vatStatus ?? null,
          whitelistCheckedAt: verified?.checkedAt ?? null,
          whitelistBankAccounts: verified?.bankAccounts ?? null,
          regon: verified?.regon ?? gus?.regon ?? null,
          legalForm: gus?.legalForm ?? null,
          updatedAt: new Date(),
        },
      });

    await tx
      .insert(userRoles)
      .values({ userId, role: "HOST_BUSINESS" })
      .onConflictDoNothing();
  });

  return { roles: await getUserRoles(userId), verified: verified !== null };
}

export async function getBusinessProfile(userId: string) {
  const [row] = await db
    .select()
    .from(businessProfiles)
    .where(eq(businessProfiles.userId, userId));

  return row ?? null;
}
