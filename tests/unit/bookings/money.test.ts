import { describe, expect, it } from "vitest";
import type { RefundRule } from "@/db/types";
import { evaluateRefund } from "@/modules/bookings/refund-policy";
import { computeCommission } from "@/modules/payouts/commission";

/** The seeded default policy (docs/PAYMENTS.md §2.3). */
const POLICY: RefundRule[] = [
  { minHoursBefore: 24, refundPct: 100 },
  { minHoursBefore: 2, refundPct: 50 },
  { minHoursBefore: 0, refundPct: 0 },
];

const now = new Date("2026-07-25T12:00:00Z");
const hoursFromNow = (hours: number) => new Date(now.getTime() + hours * 3_600_000);

describe("evaluateRefund", () => {
  it("gives everything back more than 24 h out", () => {
    expect(
      evaluateRefund({ rules: POLICY, priceGr: 3500, startsAt: hoursFromNow(48), now }),
    ).toMatchObject({ refundPct: 100, refundGr: 3500 });
  });

  it("gives half back between 2 and 24 h out", () => {
    expect(
      evaluateRefund({ rules: POLICY, priceGr: 3500, startsAt: hoursFromNow(5), now }),
    ).toMatchObject({ refundPct: 50, refundGr: 1750 });
  });

  it("gives nothing back inside 2 h", () => {
    expect(
      evaluateRefund({ rules: POLICY, priceGr: 3500, startsAt: hoursFromNow(1), now }),
    ).toMatchObject({ refundPct: 0, refundGr: 0 });
  });

  it("treats the boundary as inclusive — exactly 24 h still gets 100%", () => {
    expect(
      evaluateRefund({ rules: POLICY, priceGr: 3500, startsAt: hoursFromNow(24), now }),
    ).toMatchObject({ refundPct: 100 });
  });

  it("gives nothing back once the booking has started", () => {
    expect(
      evaluateRefund({ rules: POLICY, priceGr: 3500, startsAt: hoursFromNow(-3), now }),
    ).toMatchObject({ refundPct: 0, refundGr: 0 });
  });

  it("does not depend on the order the rules were stored in", () => {
    const shuffled = [POLICY[2]!, POLICY[0]!, POLICY[1]!];
    expect(
      evaluateRefund({ rules: shuffled, priceGr: 3500, startsAt: hoursFromNow(5), now }),
    ).toMatchObject({ refundPct: 50 });
  });

  it("refunds nothing when a policy has no applicable band", () => {
    expect(
      evaluateRefund({
        rules: [{ minHoursBefore: 72, refundPct: 100 }],
        priceGr: 3500,
        startsAt: hoursFromNow(5),
        now,
      }),
    ).toMatchObject({ refundPct: 0, refundGr: 0 });
  });

  it("rounds the refund to whole grosze", () => {
    const result = evaluateRefund({
      rules: [{ minHoursBefore: 0, refundPct: 33 }],
      priceGr: 3333,
      startsAt: hoursFromNow(5),
      now,
    });

    expect(Number.isInteger(result.refundGr)).toBe(true);
    expect(result.refundGr).toBe(1100);
  });
});

describe("computeCommission", () => {
  it("splits 50/50 for an individual host", () => {
    expect(computeCommission(3500, 50)).toEqual({
      ratePct: 50,
      commissionGr: 1750,
      hostPayoutGr: 1750,
    });
  });

  it("splits 30/70 for a business host", () => {
    expect(computeCommission(3500, 30)).toEqual({
      ratePct: 30,
      commissionGr: 1050,
      hostPayoutGr: 2450,
    });
  });

  it("keeps commission + payout = price for every price and rate (DB CHECK)", () => {
    for (let priceGr = 1; priceGr <= 5000; priceGr += 7) {
      for (const rate of [0, 13, 30, 33, 50, 67, 99, 100]) {
        const split = computeCommission(priceGr, rate);
        expect(split.commissionGr + split.hostPayoutGr).toBe(priceGr);
        expect(Number.isInteger(split.commissionGr)).toBe(true);
        expect(Number.isInteger(split.hostPayoutGr)).toBe(true);
        expect(split.hostPayoutGr).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
