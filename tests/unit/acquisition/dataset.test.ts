import { describe, expect, it } from "vitest";
import { estimateWalk } from "@/lib/format";
import {
  CANDIDATE_SITES,
  RECON_SITES,
  RESIDENTIAL_CLUSTERS,
  bySegment,
  byVenue,
  filterSites,
  totals,
} from "@/modules/acquisition";
import { SEGMENT_PLAYBOOK } from "@/modules/acquisition/segments";
import { MAX_REACH_MINUTES, suggestedRate } from "@/modules/leads/calc";

/**
 * The acquisition dataset is a GENERATED SNAPSHOT of OpenStreetMap committed to
 * the repo, and its numbers were computed by a throwaway script that no longer
 * runs in CI. So the risk is drift: somebody tunes the walk model or the rate
 * bands in the app, and this dataset silently keeps quoting the old ones to the
 * person standing in front of a property owner.
 *
 * These tests re-derive every distance-dependent figure from the app's OWN
 * functions and refuse to let the two disagree. That is the whole point — this
 * is the same failure shape as the `geography(Point,4326)` migration and the
 * dead dark-theme accent: green build, wrong output.
 */

describe("dataset integrity", () => {
  it("has no duplicate OSM ids", () => {
    const ids = CANDIDATE_SITES.map((s) => s.osm);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only uses segments the playbook can answer for", () => {
    for (const site of [...CANDIDATE_SITES, ...RECON_SITES]) {
      expect(SEGMENT_PLAYBOOK[site.segment], `segment ${site.segment}`).toBeDefined();
    }
  });

  it("keeps every site inside the app's reach window", () => {
    for (const site of [...CANDIDATE_SITES, ...RECON_SITES]) {
      const nearest = Math.min(site.walkMinutesEnea, site.walkMinutesMtp);
      expect(nearest, site.osm).toBeLessThanOrEqual(MAX_REACH_MINUTES);
      expect(site.walkMinutes, site.osm).toBe(nearest);
    }
  });

  /**
   * The load-bearing one: walk minutes must come from estimateWalk, not from a
   * constant frozen into the snapshot. Change WALK_SPEED_M_PER_MIN and this fails.
   */
  it("derives walk minutes from the app's walk model, not its own", () => {
    for (const site of CANDIDATE_SITES) {
      expect(site.walkMinutesEnea, `${site.osm} enea`).toBe(
        estimateWalk(site.distanceEneaM).minutes,
      );
      expect(site.walkMinutesMtp, `${site.osm} mtp`).toBe(estimateWalk(site.distanceMtpM).minutes);
    }
  });

  /** Same guard for money: the rate must be the band leads/calc would suggest. */
  it("quotes the rate band the landing calculator would quote", () => {
    for (const site of CANDIDATE_SITES) {
      const band = suggestedRate(site.walkMinutes);
      expect(band, site.osm).not.toBeNull();
      expect(site.rateGr, site.osm).toBe(band?.midGr);
      expect(site.rateBand, site.osm).toBe(band?.band);
    }
  });

  it("computes season gross as spots × rate × events", () => {
    for (const site of CANDIDATE_SITES) {
      expect(site.seasonGrossGr, site.osm).toBe(site.spots * site.rateGr * site.events);
    }
  });

  it("never lists a lot too small to be worth a visit", () => {
    for (const site of CANDIDATE_SITES) expect(site.spots, site.osm).toBeGreaterThanOrEqual(10);
  });

  it("attributes every spot count to a stated basis", () => {
    for (const site of CANDIDATE_SITES) {
      expect(["tag", "area", "footprint"]).toContain(site.spotsBasis);
      // An area-derived count without an area is a figure from nowhere.
      if (site.spotsBasis === "area") expect(site.areaM2, site.osm).toBeTruthy();
    }
  });

  it("gives every residential cluster enough buildings to be worth the trip", () => {
    for (const row of RESIDENTIAL_CLUSTERS) {
      expect(row.buildings, row.street).toBeGreaterThanOrEqual(3);
      expect(row.walkMinutes, row.street).toBeLessThanOrEqual(MAX_REACH_MINUTES);
    }
  });
});

describe("totals", () => {
  it("splits every lot into either already-paid or greenfield", () => {
    const t = totals();
    expect(t.paidLots + t.greenfieldLots).toBe(t.lots);
    expect(t.paidSpots + t.greenfieldSpots).toBe(t.spots);
    expect(t.lots).toBe(CANDIDATE_SITES.length);
  });

  it("counts season gross over greenfield lots only", () => {
    // Revenue we could win, not revenue somebody else already collects.
    const expected = CANDIDATE_SITES.filter((s) => !s.alreadyPaid).reduce(
      (n, s) => n + s.seasonGrossGr,
      0,
    );
    expect(totals().seasonGrossGr).toBe(expected);
  });
});

describe("bySegment", () => {
  it("accounts for every lot exactly once", () => {
    const summed = bySegment().reduce((n, s) => n + s.lots, 0);
    expect(summed).toBe(CANDIDATE_SITES.length);
  });

  it("puts tier A before tier B and C", () => {
    const tiers = bySegment().map((s) => s.tier);
    const rank = { A: 0, B: 1, C: 2 } as const;
    for (let i = 1; i < tiers.length; i++) {
      expect(rank[tiers[i]!]).toBeGreaterThanOrEqual(rank[tiers[i - 1]!]);
    }
  });
});

describe("byVenue", () => {
  it("reports both venues with their seeded event counts", () => {
    const rows = byVenue();
    expect(rows.map((r) => r.venue)).toEqual(["ENEA", "MTP"]);
    expect(rows.find((r) => r.venue === "ENEA")?.events).toBe(9);
    expect(rows.find((r) => r.venue === "MTP")?.events).toBe(8);
  });
});

describe("filterSites", () => {
  it("returns everything when nothing is asked for", () => {
    expect(filterSites({})).toHaveLength(CANDIDATE_SITES.length);
  });

  it("filters by segment", () => {
    const rows = filterSites({ segment: "INDUSTRIAL" });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.segment).toBe("INDUSTRIAL");
  });

  it("hides lots that already sell parking", () => {
    const rows = filterSites({ supply: "green" });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.alreadyPaid).toBe(false);
  });

  it("filters by venue reach, not by nearest venue", () => {
    for (const row of filterSites({ venue: "MTP" })) {
      expect(row.walkMinutesMtp).toBeLessThanOrEqual(15);
    }
  });

  it("searches name, owner, street and operator", () => {
    const rows = filterSites({ q: "apcoa" });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const haystack = [row.name, row.ownerName, row.street, row.operator, row.osm]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      expect(haystack).toContain("apcoa");
    }
  });

  it("combines filters instead of picking one", () => {
    const rows = filterSites({ segment: "INDUSTRIAL", supply: "green" });
    for (const row of rows) {
      expect(row.segment).toBe("INDUSTRIAL");
      expect(row.alreadyPaid).toBe(false);
    }
  });

  it("returns nothing for a query that matches nothing, rather than everything", () => {
    expect(filterSites({ q: "zzzzz-nie-ma-takiego-placu" })).toHaveLength(0);
  });
});
