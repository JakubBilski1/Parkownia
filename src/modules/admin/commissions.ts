import { desc, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { commissionRules, parkings, users } from "@/db/schema";
import { AdminError, notFound } from "./errors";
import { commissionRuleSchema, deleteCommissionRuleSchema } from "./schemas";

type Scope = (typeof commissionRules.$inferSelect)["scope"];

export type CommissionRuleRow = {
  id: string;
  scope: Scope;
  ratePct: number;
  validFrom: Date;
  userId: string | null;
  parkingId: string | null;
  /** Whose rate this is, in words: host e-mail or parking title. */
  targetLabel: string | null;
};

const targetLabelSql = sql<string | null>`coalesce(${users.email}, ${parkings.title})`;

async function selectRules(onlyEffective: boolean): Promise<CommissionRuleRow[]> {
  return db
    .select({
      id: commissionRules.id,
      scope: commissionRules.scope,
      ratePct: commissionRules.ratePct,
      validFrom: commissionRules.validFrom,
      userId: commissionRules.userId,
      parkingId: commissionRules.parkingId,
      targetLabel: targetLabelSql,
    })
    .from(commissionRules)
    .leftJoin(users, eq(users.id, commissionRules.userId))
    .leftJoin(parkings, eq(parkings.id, commissionRules.parkingId))
    .where(onlyEffective ? lte(commissionRules.validFrom, new Date()) : undefined)
    .orderBy(desc(commissionRules.validFrom), desc(commissionRules.createdAt));
}

function keyOf(rule: CommissionRuleRow): string {
  return `${rule.scope}:${rule.userId ?? rule.parkingId ?? ""}`;
}

export type CommissionRules = {
  /** The two rates that apply when nothing overrides them (50 / 30 from the seed). */
  globals: CommissionRuleRow[];
  /** Currently effective per-host and per-parking overrides. */
  overrides: CommissionRuleRow[];
  /** Superseded versions, newest first — a rate change must stay auditable. */
  superseded: CommissionRuleRow[];
};

export async function listCommissionRules(): Promise<CommissionRules> {
  const rules = await selectRules(true);

  const effective = new Map<string, CommissionRuleRow>();
  const superseded: CommissionRuleRow[] = [];

  // Already sorted newest-first, so the first row per target is the one in force.
  for (const rule of rules) {
    const key = keyOf(rule);
    if (effective.has(key)) superseded.push(rule);
    else effective.set(key, rule);
  }

  const current = [...effective.values()];

  return {
    globals: current
      .filter((rule) => rule.scope === "GLOBAL_INDIVIDUAL" || rule.scope === "GLOBAL_BUSINESS")
      .sort((a, b) => a.scope.localeCompare(b.scope)),
    overrides: current.filter((rule) => rule.scope === "USER" || rule.scope === "PARKING"),
    superseded,
  };
}

export type SetCommissionRuleResult = {
  ruleId: string;
  scope: Scope;
  ratePct: number;
  validFrom: Date;
};

/**
 * A rate change is a new version, never an UPDATE: bookings freeze their rate at
 * purchase time, and history has to stay explicable months later.
 */
export async function setCommissionRule(input: unknown): Promise<SetCommissionRuleResult> {
  const { scope, userId, parkingId, ratePct } = commissionRuleSchema.parse(input);

  if (scope === "USER" && userId) {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw notFound("Użytkownik");
  }

  if (scope === "PARKING" && parkingId) {
    const [parking] = await db
      .select({ id: parkings.id })
      .from(parkings)
      .where(eq(parkings.id, parkingId))
      .limit(1);
    if (!parking) throw notFound("Parking");
  }

  const validFrom = new Date();
  const [row] = await db
    .insert(commissionRules)
    .values({
      scope,
      userId: scope === "USER" ? (userId ?? null) : null,
      parkingId: scope === "PARKING" ? (parkingId ?? null) : null,
      ratePct,
      validFrom,
    })
    .returning({ id: commissionRules.id });

  if (!row) throw new AdminError("INVALID_STATE", 500, "Nie udało się zapisać stawki.");

  return { ruleId: row.id, scope, ratePct, validFrom };
}

/** Removes an override so the global rate applies again. Globals cannot be deleted. */
export async function deleteCommissionOverride(input: unknown): Promise<{ ruleId: string }> {
  const { ruleId } = deleteCommissionRuleSchema.parse(input);

  const [rule] = await db
    .select({ id: commissionRules.id, scope: commissionRules.scope })
    .from(commissionRules)
    .where(eq(commissionRules.id, ruleId))
    .limit(1);

  if (!rule) throw notFound("Stawka");

  if (rule.scope === "GLOBAL_INDIVIDUAL" || rule.scope === "GLOBAL_BUSINESS") {
    throw new AdminError(
      "INVALID_STATE",
      422,
      "Stawki globalnej nie da się usunąć — bez niej nie policzymy prowizji. Zmień jej wartość zamiast usuwać.",
    );
  }

  await db.delete(commissionRules).where(eq(commissionRules.id, ruleId));
  return { ruleId };
}

/**
 * PARKING > USER > GLOBAL_(owner_type), newest version wins (DATA_MODEL §6).
 *
 * There is exactly one implementation of this rule, and it is not here:
 * `resolveCommissionRatePct` in src/modules/payouts/service.ts. That one takes an
 * Executor, so the booking transaction resolves the rate under the same row lock
 * that reserves the spot. Two resolvers would eventually disagree about money.
 */
export { resolveCommissionRatePct } from "@/modules/payouts/service";
