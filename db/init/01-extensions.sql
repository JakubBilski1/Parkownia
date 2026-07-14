-- Runs once, on first container init, via docker-entrypoint-initdb.d.
-- postgis: geography(Point,4326) + GiST indexes for geo queries (docs/ARCHITECTURE.md §3).
-- citext:  case-insensitive text (emails).
-- pgcrypto: gen_random_uuid() for primary keys.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
