import { type SQL, sql } from "drizzle-orm";
import { customType } from "drizzle-orm/pg-core";

export type Point = {
  lng: number;
  lat: number;
};

export type BoundingBox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

const SRID = 4326;
const EWKB_SRID_FLAG = 0x20000000;
const EWKB_TYPE_POINT = 1;

// postgres-js returns geography columns as EWKB hex ("0101000020E6100000…").
// PostGIS ships no text decoder on the client side, so we decode the 21/25-byte
// point payload ourselves instead of forcing every read through ST_X/ST_Y.
export function parseEwkbPoint(hex: string): Point {
  const buf = Buffer.from(hex, "hex");
  if (buf.length < 21) {
    throw new Error(`Not an EWKB point: ${hex.slice(0, 32)}`);
  }

  const littleEndian = buf.readUInt8(0) === 1;
  const readU32 = (offset: number) =>
    littleEndian ? buf.readUInt32LE(offset) : buf.readUInt32BE(offset);
  const readF64 = (offset: number) =>
    littleEndian ? buf.readDoubleLE(offset) : buf.readDoubleBE(offset);

  const typeWord = readU32(1);
  if ((typeWord & 0xff) !== EWKB_TYPE_POINT) {
    throw new Error(`Expected EWKB point, got type ${typeWord & 0xff}`);
  }

  const coordsOffset = (typeWord & EWKB_SRID_FLAG) !== 0 ? 9 : 5;

  return {
    lng: readF64(coordsOffset),
    lat: readF64(coordsOffset + 8),
  };
}

export const geographyPoint = customType<{
  data: Point;
  driverData: string;
  config: undefined;
}>({
  dataType() {
    return `geography(Point,${SRID})`;
  },
  toDriver(value: Point): SQL {
    return sql`ST_SetSRID(ST_MakePoint(${value.lng}, ${value.lat}), ${sql.raw(String(SRID))})::geography`;
  },
  fromDriver(value: string): Point {
    return parseEwkbPoint(value);
  },
});

export function toPoint(point: Point): SQL<Point> {
  return sql<Point>`ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), ${sql.raw(String(SRID))})::geography`;
}

export function fromPoint(column: SQL | unknown): SQL<Point> {
  return sql<Point>`json_build_object('lng', ST_X(${column}::geometry), 'lat', ST_Y(${column}::geometry))`;
}

// ST_DWithin on geography is index-assisted: the planner rewrites it into a
// bbox check against the GiST index plus an exact distance filter. Passing the
// point as a bound parameter (not a subquery) is what keeps it sargable.
export function stDWithin(column: SQL | unknown, point: Point, radiusMeters: number): SQL<boolean> {
  return sql<boolean>`ST_DWithin(${column}, ${toPoint(point)}, ${radiusMeters})`;
}

export function stMakeEnvelope(bbox: BoundingBox): SQL {
  return sql`ST_MakeEnvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}, ${sql.raw(String(SRID))})::geography`;
}

export function stIntersectsEnvelope(column: SQL | unknown, bbox: BoundingBox): SQL<boolean> {
  return sql<boolean>`ST_Intersects(${column}, ${stMakeEnvelope(bbox)})`;
}

export function stDistance(column: SQL | unknown, point: Point): SQL<number> {
  return sql<number>`ST_Distance(${column}, ${toPoint(point)})`;
}
