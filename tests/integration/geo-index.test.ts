import { and, eq, sql, type SQL } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { stDWithin, stIntersectsEnvelope, toPoint } from "@/db/geo";
import { parkings } from "@/db/schema";
import { findParkingsInBbox, findParkingsNearby } from "@/modules/parkings/queries";
import { createBulkParkings, createHost, ENEA } from "./fixtures";

/**
 * A performance regression test, and the only kind that is worth anything: it
 * asks Postgres what it actually did, rather than timing the query and hoping.
 *
 * The map fires a bounding-box query on every pan and a radius query on every
 * "co jest blisko?" — over the whole parkings table. On the GiST index that is a
 * few pages. Without it, it is a sequential scan of every parking in Poznań, on a
 * phone, on 3G, outside a stadium. It survives 500 rows and dies at 5000, which is
 * precisely the kind of failure that does not show up in development.
 *
 * The predicates under test are the ones the application builds — stDWithin() and
 * stIntersectsEnvelope() from src/db/geo.ts, the same functions findParkingsNearby()
 * and findParkingsInBbox() call. Rewrite one of them into something non-sargable
 * (wrap the column in a function, cast it, compare ST_Distance to a constant) and
 * this test fails, which is the entire point.
 */

const RADIUS_METERS = 1500;

const BBOX = { west: 16.84, south: 52.38, east: 16.88, north: 52.42 };

/** Enough rows that a sequential scan is a real choice the planner could make. */
const BULK_PARKINGS = 500;

async function explain(query: { getSQL: () => SQL }): Promise<string> {
  const rows = await db.execute(sql`EXPLAIN (ANALYZE, BUFFERS) ${query.getSQL()}`);
  const list = Array.isArray(rows) ? rows : ((rows as { rows?: unknown[] }).rows ?? []);
  return list.map((row) => (row as Record<string, string>)["QUERY PLAN"]).join("\n");
}

/** Bitmap Index Scan or Index Scan — both read the index; only Seq Scan does not. */
function usesGistIndex(plan: string): boolean {
  return /(Bitmap )?Index Scan.*parkings_location_gist_idx/.test(plan);
}

function scansWholeTable(plan: string): boolean {
  return /Seq Scan on parkings/.test(plan);
}

describe("geo queries run on the GiST index, not on every row", () => {
  it("ST_DWithin (the radius search) is answered from parkings_location_gist_idx", async () => {
    const host = await createHost();
    await createBulkParkings(host.id, BULK_PARKINGS);

    const query = db
      .select({ id: parkings.id })
      .from(parkings)
      .where(and(stDWithin(parkings.location, ENEA, RADIUS_METERS), eq(parkings.status, "ACTIVE")));

    const plan = await explain(query);

    expect(usesGistIndex(plan), `plan was:\n${plan}`).toBe(true);
    expect(scansWholeTable(plan), `plan was:\n${plan}`).toBe(false);
    // The predicate is evaluated inside the index, not as a filter on rows the
    // index handed back for other reasons.
    expect(plan).toMatch(/Index Cond/);
  });

  it("the bounding box (every map pan) is answered from parkings_location_gist_idx", async () => {
    const host = await createHost();
    await createBulkParkings(host.id, BULK_PARKINGS);

    const query = db
      .select({ id: parkings.id })
      .from(parkings)
      .where(
        and(stIntersectsEnvelope(parkings.location, BBOX), eq(parkings.status, "ACTIVE")),
      );

    const plan = await explain(query);

    expect(usesGistIndex(plan), `plan was:\n${plan}`).toBe(true);
    expect(scansWholeTable(plan), `plan was:\n${plan}`).toBe(false);
    expect(plan).toMatch(/Index Cond/);
  });

  /**
   * The control. Without it the two assertions above could be passing because
   * Postgres uses that index for everything — and they would keep passing after a
   * regression. This is the naive way to write the same filter, it cannot use the
   * index, and the test asserts that the difference is visible.
   */
  it("proves the assertion has teeth: ST_Distance(...) < r cannot use the index", async () => {
    const host = await createHost();
    await createBulkParkings(host.id, BULK_PARKINGS);

    const nonSargable = db
      .select({ id: parkings.id })
      .from(parkings)
      .where(
        and(
          sql`ST_Distance(${parkings.location}, ${toPoint(ENEA)}) < ${RADIUS_METERS}`,
          eq(parkings.status, "ACTIVE"),
        ),
      );

    const plan = await explain(nonSargable);

    expect(scansWholeTable(plan), `plan was:\n${plan}`).toBe(true);
    expect(usesGistIndex(plan), `plan was:\n${plan}`).toBe(false);
  });

  it("and the module functions still return the right parkings", async () => {
    const host = await createHost();
    await createBulkParkings(host.id, BULK_PARKINGS);

    // Behaviour, not just plans: an index the planner loves and a query that
    // returns the wrong rows is not an improvement.
    const nearby = await findParkingsNearby(ENEA, RADIUS_METERS, 50, { spots: 1 });

    expect(nearby.length).toBeGreaterThan(0);
    expect(nearby.every((pin) => pin.straightLineMeters <= RADIUS_METERS)).toBe(true);

    // Ordered by distance — the driver reads the list top-down.
    const distances = nearby.map((pin) => pin.straightLineMeters);
    expect([...distances].sort((a, b) => a - b)).toEqual(distances);

    const inBox = await findParkingsInBbox(BBOX, { spots: 1 });
    expect(inBox.length).toBeGreaterThan(0);
    expect(
      inBox.every(
        (pin) =>
          pin.lng >= BBOX.west &&
          pin.lng <= BBOX.east &&
          pin.lat >= BBOX.south &&
          pin.lat <= BBOX.north,
      ),
    ).toBe(true);
  });
});
