import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { businessProfiles, parkings, userRoles, users } from "@/db/schema";
import { getPaymentProvider } from "./factory";
import { supportsConnect, type ConnectAccountState } from "./provider";

/**
 * Host onboarding: the half of the money flow that is not about taking money.
 *
 * The rule this module exists to enforce (docs/PAYMENTS.md §2.2):
 *
 *   a parking must not go on sale until Stripe says we can pay its host.
 *
 * Everything else here is in service of that one sentence. Selling a spot for a
 * host whose payouts are blocked does not fail at payout time — it fails three
 * weeks later, as a debt to a person who already let a stranger park on their
 * driveway. That is not a bug to fix in the next sprint; it is money we owe and
 * cannot move.
 *
 * The rule is enforced ONLY when a real PSP is configured. Under the mock there
 * is no Stripe, no KYC and no account to enable — enforcing it there would lock
 * every developer out of publishing a parking on a laptop, and a rule that makes
 * the product unusable in dev is a rule that gets deleted.
 */

export type HostOnboardingStatus = {
  /** True once the host has a connected account, finished or not. */
  connected: boolean;
  /** Stripe's verdicts. Both false until the hosted KYC clears. */
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  /**
   * Whether the host must finish onboarding before their parkings can be sold.
   * False under the mock provider — nothing to finish, nothing to block.
   */
  required: boolean;
};

/** The payouts gate. Under the mock it is open; under Stripe, Stripe decides. */
function payoutsAreEnforced(): boolean {
  return supportsConnect(getPaymentProvider());
}

export async function getHostOnboardingStatus(userId: string): Promise<HostOnboardingStatus> {
  const [row] = await db
    .select({
      stripeAccountId: users.stripeAccountId,
      chargesEnabled: users.chargesEnabled,
      payoutsEnabled: users.payoutsEnabled,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return {
    connected: Boolean(row?.stripeAccountId),
    chargesEnabled: row?.chargesEnabled ?? false,
    payoutsEnabled: row?.payoutsEnabled ?? false,
    required: payoutsAreEnforced(),
  };
}

export class OnboardingUnavailableError extends Error {
  constructor(message = "Onboarding hosta jest niedostępny dla tego dostawcy płatności.") {
    super(message);
    this.name = "OnboardingUnavailableError";
  }
}

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return new URL(path, base).toString();
}

/**
 * Returns the URL of Stripe's hosted KYC. Creates the connected account on the
 * first call and remembers its id; every later call reuses that account and only
 * mints a fresh link, because the links expire in minutes and are single-use.
 *
 * Deliberately NOT idempotent through a stored link, and deliberately idempotent
 * through the stored account id: minting a second account for a host who clicked
 * twice would split their earnings across two ledgers Stripe will never merge.
 */
export async function startHostOnboarding(userId: string): Promise<{ url: string }> {
  const provider = getPaymentProvider();
  if (!supportsConnect(provider)) {
    throw new OnboardingUnavailableError();
  }

  const [row] = await db
    .select({
      email: users.email,
      stripeAccountId: users.stripeAccountId,
      companyName: businessProfiles.companyName,
      nip: businessProfiles.nip,
    })
    .from(users)
    .leftJoin(businessProfiles, eq(businessProfiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) {
    throw new OnboardingUnavailableError("Nie znaleźliśmy tego konta.");
  }

  let accountId = row.stripeAccountId;

  if (!accountId) {
    // A company profile (NIP) is what makes a host a company to Stripe — not the
    // role flag alone, because the role can be granted before the NIP is filled.
    const isCompany = Boolean(row.nip) && (await hasRole(userId, "HOST_BUSINESS"));

    accountId = await provider.createConnectedAccount({
      email: row.email,
      businessType: isCompany ? "company" : "individual",
      companyName: row.companyName,
      nip: row.nip,
    });

    await db
      .update(users)
      .set({ stripeAccountId: accountId, updatedAt: sql`now()` })
      .where(eq(users.id, userId));
  }

  const url = await provider.createAccountLink({
    accountId,
    // Stripe sends the host here when the link went stale in their tab. The page
    // just starts onboarding again — the host never sees the word "expired".
    refreshUrl: appUrl("/panel/wyplaty?onboarding=odswiez"),
    returnUrl: appUrl("/panel/wyplaty?onboarding=powrot"),
  });

  return { url };
}

async function hasRole(userId: string, role: "HOST_BUSINESS"): Promise<boolean> {
  const [row] = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(sql`${userRoles.userId} = ${userId} AND ${userRoles.role} = ${role}`)
    .limit(1);

  return Boolean(row);
}

/**
 * The account.updated webhook, applied. Stripe's verdict overwrites ours, in
 * both directions: an account that loses payouts (a document expired, a bank
 * account bounced) must go back to blocked, not stay enabled because it once was.
 *
 * Matched on the account id, which is why that column is UNIQUE — a second user
 * carrying the same connected account would make this update ambiguous.
 */
export async function applyAccountUpdate(state: ConnectAccountState): Promise<"APPLIED" | "UNKNOWN_ACCOUNT"> {
  const updated = await db
    .update(users)
    .set({
      chargesEnabled: state.chargesEnabled,
      payoutsEnabled: state.payoutsEnabled,
      updatedAt: sql`now()`,
    })
    .where(eq(users.stripeAccountId, state.accountId))
    .returning({ id: users.id });

  if (updated.length === 0) {
    // An account we do not know. Not an error — Stripe sends events for accounts
    // created by other integrations on the same platform key. No id is logged.
    return "UNKNOWN_ACCOUNT";
  }

  return "APPLIED";
}

/**
 * Reconciliation for a host coming back from the hosted form. The webhook is the
 * source of truth, but it lands a second or two later — and the host is standing
 * on /panel/wyplaty *right now*, having just finished, looking at a page that
 * still says "verification pending". So the return path asks Stripe directly.
 */
export async function refreshHostAccountState(userId: string): Promise<HostOnboardingStatus> {
  const provider = getPaymentProvider();
  const status = await getHostOnboardingStatus(userId);

  if (!supportsConnect(provider) || !status.connected) return status;

  const [row] = await db
    .select({ stripeAccountId: users.stripeAccountId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row?.stripeAccountId) return status;

  try {
    const state = await provider.retrieveAccountState(row.stripeAccountId);
    await applyAccountUpdate(state);

    return {
      connected: true,
      chargesEnabled: state.chargesEnabled,
      payoutsEnabled: state.payoutsEnabled,
      required: true,
    };
  } catch {
    // Stripe being unreachable is not a reason to tell a host their account is
    // broken. Fall back to what the webhook last wrote.
    return status;
  }
}

/* -------------------------------------------------------------------------- */
/* The gate                                                                   */
/* -------------------------------------------------------------------------- */

export type PublicationBlock = {
  reason: "PAYOUTS_NOT_ENABLED";
  message: string;
};

/**
 * Called on submit-for-review and on admin approval — both doors into ACTIVE.
 * Returns null when the parking may be published, or the reason it may not.
 *
 * Checked at BOTH doors on purpose. A parking can sit in the review queue for a
 * day; a host who was verified when they submitted can have payouts pulled by
 * Stripe before an admin clicks approve, and the approval is the moment the spot
 * actually goes on sale.
 */
export async function checkHostCanPublish(hostId: string): Promise<PublicationBlock | null> {
  if (!payoutsAreEnforced()) return null;

  const [row] = await db
    .select({ payoutsEnabled: users.payoutsEnabled })
    .from(users)
    .where(eq(users.id, hostId))
    .limit(1);

  if (row?.payoutsEnabled) return null;

  return {
    reason: "PAYOUTS_NOT_ENABLED",
    message:
      "Zanim parking trafi do sprzedaży, dokończ weryfikację w Stripe — bez niej nie mamy jak przelać Ci pieniędzy za rezerwacje.",
  };
}

/**
 * The destination of a charge, resolved from the parking being booked.
 *
 * Returns the account only when charges are enabled. A host mid-onboarding has
 * an account id and no ability to receive money, and handing that id to Stripe
 * as a destination fails the charge at the worst possible moment — with the
 * driver's thumb on the BLIK keypad.
 */
export async function resolveHostAccountForParking(parkingId: string): Promise<string | null> {
  const [row] = await db
    .select({
      stripeAccountId: users.stripeAccountId,
      chargesEnabled: users.chargesEnabled,
    })
    .from(parkings)
    .innerJoin(users, eq(users.id, parkings.ownerId))
    .where(eq(parkings.id, parkingId))
    .limit(1);

  if (!row?.stripeAccountId || !row.chargesEnabled) return null;

  return row.stripeAccountId;
}
