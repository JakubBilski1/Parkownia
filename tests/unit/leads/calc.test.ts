import { describe, expect, it } from "vitest";
import { estimateWalk } from "@/lib/format";
import {
  COMMISSION_PCT,
  MAX_REACH_MINUTES,
  commissionPctFor,
  reachRadiusMeters,
  revenueEstimate,
  suggestedRate,
  walkMinutes,
} from "@/modules/leads/calc";

describe("leads calculator", () => {
  describe("suggestedRate", () => {
    it("is dearest closest to the gate and cheaper further out", () => {
      const near = suggestedRate(3)!;
      const mid = suggestedRate(8)!;
      const far = suggestedRate(13)!;
      expect(near.midGr).toBeGreaterThan(mid.midGr);
      expect(mid.midGr).toBeGreaterThan(far.midGr);
    });

    it("keeps min <= mid <= max in every band", () => {
      for (const m of [1, 5, 6, 10, 11, 15]) {
        const r = suggestedRate(m)!;
        expect(r.minGr).toBeLessThanOrEqual(r.midGr);
        expect(r.midGr).toBeLessThanOrEqual(r.maxGr);
      }
    });

    it("returns null past the reach horizon", () => {
      expect(suggestedRate(MAX_REACH_MINUTES + 1)).toBeNull();
      expect(suggestedRate(40)).toBeNull();
    });

    it("puts the band boundary at 5 minutes", () => {
      expect(suggestedRate(5)!.band).toBe(suggestedRate(1)!.band);
      expect(suggestedRate(6)!.band).not.toBe(suggestedRate(5)!.band);
    });
  });

  describe("revenueEstimate", () => {
    it("splits gross into commission and net", () => {
      const r = revenueEstimate({ rateGr: 4000, spots: 10, events: 9, commissionPct: 50 });
      expect(r.perEventGrossGr).toBe(40_000);
      expect(r.annualGrossGr).toBe(360_000);
      expect(r.commissionGr).toBe(180_000);
      expect(r.annualNetGr).toBe(180_000);
      expect(r.commissionGr + r.annualNetGr).toBe(r.annualGrossGr);
    });

    it("leaves a business and an individual the same take-home (one rate since 2026-10-10)", () => {
      const base = { rateGr: 3000, spots: 20, events: 12 };
      const indiv = revenueEstimate({ ...base, commissionPct: COMMISSION_PCT.individual });
      const biz = revenueEstimate({ ...base, commissionPct: COMMISSION_PCT.business });
      expect(biz.annualNetGr).toBe(indiv.annualNetGr);
    });

    it("is zero across the board with zero events in reach", () => {
      const r = revenueEstimate({ rateGr: 5000, spots: 30, events: 0, commissionPct: 50 });
      expect(r.annualGrossGr).toBe(0);
      expect(r.annualNetGr).toBe(0);
    });
  });

  describe("commissionPctFor", () => {
    it("maps owner kind to the mirrored commission_rules rates", () => {
      expect(commissionPctFor("INDIVIDUAL")).toBe(25);
      expect(commissionPctFor("BUSINESS")).toBe(25);
    });
  });

  describe("reachRadiusMeters", () => {
    it("agrees with the app walk model at each ring boundary", () => {
      for (const minutes of [5, 10, 15]) {
        expect(estimateWalk(reachRadiusMeters(minutes)).minutes).toBe(minutes);
      }
    });

    it("grows with the minute threshold", () => {
      expect(reachRadiusMeters(5)).toBeLessThan(reachRadiusMeters(10));
      expect(reachRadiusMeters(10)).toBeLessThan(reachRadiusMeters(15));
    });
  });

  describe("walkMinutes", () => {
    it("never claims zero minutes for a nonzero distance", () => {
      expect(walkMinutes(1)).toBeGreaterThanOrEqual(1);
    });
  });
});
