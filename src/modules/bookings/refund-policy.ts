import type { RefundRule } from "@/db/types";

/**
 * Pure, and deliberately kept out of cancel.ts: the rules that decide how much
 * of someone's money comes back must be unit-testable without a database
 * connection. cancel.ts re-exports this.
 *
 * Rules are read as thresholds, richest first: the driver gets the best band
 * whose `minHoursBefore` they still clear. No matching band means no refund.
 */
export function evaluateRefund(input: {
  rules: RefundRule[];
  priceGr: number;
  startsAt: Date;
  now?: Date;
}): { refundPct: number; refundGr: number; hoursBefore: number } {
  const now = input.now ?? new Date();
  const hoursBefore = (input.startsAt.getTime() - now.getTime()) / 3_600_000;

  const band = [...input.rules]
    .sort((a, b) => b.minHoursBefore - a.minHoursBefore)
    .find((rule) => hoursBefore >= rule.minHoursBefore);

  const refundPct = band?.refundPct ?? 0;
  return {
    refundPct,
    refundGr: Math.round((input.priceGr * refundPct) / 100),
    hoursBefore: Math.floor(hoursBefore),
  };
}
