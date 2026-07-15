#!/bin/sh
# Brings the database up to date, then hands over to the server.
#
# The container is the deployment unit — there is no compose file and no separate
# migration job — so the schema has to be reconciled here, before the app takes
# its first request. Both steps below are idempotent and safe to repeat on every
# restart and every rollout.
#
# Sized for one replica (Hetzner CX33, docs/ARCHITECTURE.md). Two containers
# starting at the same instant would both try to migrate; Postgres serialises the
# DDL so this is not corrupting, but if you ever scale past one replica, run
# migrations as a separate step and set RUN_MIGRATIONS=false here.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "docker-entrypoint: DATABASE_URL is not set — the app cannot start." >&2
  echo "  docker run -e DATABASE_URL=\"postgresql://user:pass@host:5432/parkownia\" ..." >&2
  exit 1
fi

# Schema. Fails loudly and stops the container: serving against a half-migrated
# database is worse than not serving at all.
if [ "${RUN_MIGRATIONS:-true}" != "false" ]; then
  echo "docker-entrypoint: applying migrations..."
  node scripts/migrate.mjs
fi

# Reference data: commission rules (50% private / 30% business), the default
# refund policy, venues and events. Not optional dev noise — resolveCommissionRatePct
# throws when no rule matches, so on a fresh database every booking would fail.
#
# Idempotent (deterministic ids + ON CONFLICT DO NOTHING), but it re-inserts the
# seeded venues and events on every boot. Once you manage those from the admin
# panel, set RUN_SEED=false — otherwise an event you deleted comes back on the
# next restart.
#
# SEED_DEV is never set here: test accounts and demo parkings stay out of production.
if [ "${RUN_SEED:-true}" != "false" ]; then
  echo "docker-entrypoint: seeding reference data..."
  node dist/seed.mjs
fi

exec "$@"
