-- Extensions required by Parkownia. Run ONCE against the target database, before
-- the first migration, with a role allowed to create extensions (superuser, or
-- rds_superuser / cloudsqlsuperuser on managed Postgres):
--
--   psql "$DATABASE_URL" -f db/extensions.sql
--
-- postgis:  geography(Point,4326) + GiST indexes — every geo query depends on it
--           (docs/ARCHITECTURE.md §3). Without it the first migration fails.
-- citext:   case-insensitive text (emails).
-- pgcrypto: gen_random_uuid() for primary keys.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
