import { describe, expect, it } from "vitest";
import {
  CURRENT,
  DECIDED,
  FOUNDING_PCT,
  PROPOSED,
  SCENARIO_RESULTS,
  evaluate,
  FINDINGS,
  RECOMMENDATION,
} from "@/modules/acquisition/economics";
import { COMMISSION_PCT } from "@/modules/leads/calc";

/**
 * The commission argument on /admin/akwizycja is arithmetic, and it has to stay
 * arithmetic. It is pinned to the 50/30 split it was written about; the live
 * rates it led to are DECIDED, read from the app's single source.
 */

describe("commission analysis", () => {
  it("reads the decided rates from the app's single source, not a copy", () => {
    expect(DECIDED).toBe(COMMISSION_PCT);
  });

  it("went at least as far as the proposal for both owner kinds", () => {
    expect(DECIDED.individual).toBeLessThanOrEqual(PROPOSED.individual);
    expect(DECIDED.business).toBeLessThanOrEqual(PROPOSED.business);
  });

  it("proposes a lower rate than today for both owner kinds", () => {
    expect(PROPOSED.individual).toBeLessThan(CURRENT.individual);
    expect(PROPOSED.business).toBeLessThan(CURRENT.business);
  });

  it("keeps the direction of the split — individuals still cost more to serve", () => {
    expect(PROPOSED.individual).toBeGreaterThan(PROPOSED.business);
  });

  it("prices the founding cohort below every steady-state rate", () => {
    expect(FOUNDING_PCT).toBeLessThan(PROPOSED.business);
    expect(FOUNDING_PCT).toBeLessThan(PROPOSED.individual);
  });

  it("leaves the host more money at the proposed rate than today", () => {
    for (const r of SCENARIO_RESULTS) {
      expect(r.proposedNetGr, r.scenario.key).toBeGreaterThan(r.currentNetGr);
      expect(r.foundingNetGr, r.scenario.key).toBeGreaterThan(r.proposedNetGr);
    }
  });

  it("splits gross into host take-home and commission with nothing lost", () => {
    for (const r of SCENARIO_RESULTS) {
      const commission = Math.round((r.grossGr * r.currentPct) / 100);
      expect(r.currentNetGr + commission, r.scenario.key).toBe(r.grossGr);
    }
  });

  /**
   * The headline finding: at 50% a private host barely beats a cardboard sign.
   * If a rate change ever made that comfortable, the page's argument would be
   * stale and this test is how we find out.
   */
  it("shows the private host's advantage over cash is thin at today's rate", () => {
    const priv = SCENARIO_RESULTS.filter((r) => r.scenario.owner === "INDIVIDUAL");
    expect(priv.length).toBeGreaterThan(0);
    for (const r of priv) {
      expect(r.outsideOptionGr, r.scenario.key).not.toBeNull();
      // Under 40% of gross of headroom is "thin" — nobody changes habits for that.
      expect(r.currentAdvantageGr!, r.scenario.key).toBeLessThan(r.grossGr * 0.4);
      // And the proposal has to actually improve it, or it is not a proposal.
      expect(r.proposedAdvantageGr!, r.scenario.key).toBeGreaterThan(r.currentAdvantageGr!);
    }
  });

  it("gives businesses no cash alternative, because they have none", () => {
    for (const r of SCENARIO_RESULTS.filter((s) => s.scenario.owner === "BUSINESS")) {
      expect(r.outsideOptionGr, r.scenario.key).toBeNull();
      expect(r.currentAdvantageGr, r.scenario.key).toBeNull();
    }
  });

  it("evaluates a scenario the same way twice", () => {
    const [first] = SCENARIO_RESULTS;
    expect(evaluate(first!.scenario)).toEqual(first);
  });
});

describe("findings", () => {
  it("states a verdict and a body for each", () => {
    expect(FINDINGS.length).toBeGreaterThan(0);
    for (const f of FINDINGS) {
      expect(["BAD", "OK", "FIX"]).toContain(f.verdict);
      expect(f.title.length).toBeGreaterThan(10);
      expect(f.body.length).toBeGreaterThan(80);
    }
  });

  it("does not bury the problem — at least one verdict is BAD", () => {
    expect(FINDINGS.some((f) => f.verdict === "BAD")).toBe(true);
  });

  it("pairs every recommendation with a reason", () => {
    for (const r of RECOMMENDATION) {
      expect(r.value.length).toBeGreaterThan(0);
      expect(r.detail.length).toBeGreaterThan(30);
    }
  });
});
