# ParkSpot — production image. One image, one job: serve the app on :3000.
#
# The database is NOT in here. ParkSpot expects an external PostgreSQL with
# PostGIS, reachable over DATABASE_URL — on the VPS that is the Postgres you
# already run. There is deliberately no docker-compose: this image is the whole
# deployment unit (README.md → "Wdrożenie na VPS").
#
#   docker build -t parkspot --build-arg NEXT_PUBLIC_APP_URL=https://parkspot.pl .
#   docker run -d -p 3000:3000 -e DATABASE_URL="postgresql://..." parkspot
#
# On start the container brings the database up to date before it serves a single
# request: migrations, then the reference data the app cannot run without
# (commission rules — resolveCommissionRatePct throws without them, so a booking
# on an unseeded database would fail). Both steps are idempotent and both can be
# turned off with RUN_MIGRATIONS=false / RUN_SEED=false. See docker-entrypoint.sh.
#
# Stages: deps -> builder -> runner. Only `runner` ships.

# ---------- deps: install every dependency once -------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

# Alpine's musl needs libc6-compat for native deps (@node-rs/argon2).
RUN apk add --no-cache libc6-compat

# Manifests only, so this layer stays cached until dependencies actually change.
COPY package.json package-lock.json ./
# Dev dependencies included on purpose — the build needs typescript, tailwind and
# esbuild. None of this reaches the final image.
RUN npm ci

# ---------- builder: compile the app and the seed runner -----------------------
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Telemetry off: the build must not phone home from CI or from a customer's VPS.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# NEXT_PUBLIC_* is inlined into the client bundle at build time, so it has to be
# present here — not just at runtime. A wrong value here means wrong absolute
# links (payment returns, e-mail links) in the shipped JS.
#   docker build --build-arg NEXT_PUBLIC_APP_URL=https://parkspot.pl .
ARG NEXT_PUBLIC_APP_URL="http://localhost:3000"
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

RUN npm run build

# The seed is TypeScript and the runtime image has no tsx, so bundle it here into
# plain ESM. Same source as `npm run db:seed`, so prod and dev cannot drift.
RUN npm run build:seed

# ---------- runner: what actually ships ---------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root. Never run the server as uid 0.
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 --ingroup nodejs nextjs

# Static assets and public files are NOT part of the standalone bundle — they
# have to be copied next to it explicitly.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Startup database work: the migration runner, the SQL it applies, and the
# bundled seed. Small — SQL text and two scripts.
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/db/extensions.sql ./db/extensions.sql
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/dist/seed.mjs ./dist/seed.mjs

# Next traces only what the app imports, and the app never imports the migrator —
# so drizzle-orm lands in the standalone bundle without drizzle-orm/postgres-js/
# migrator, and migrate.mjs would die on a missing module. Overlay the two full
# packages; both have zero dependencies, so this pulls in nothing else.
# (@node-rs/argon2, which the seed needs, is already traced in — the app hashes
# passwords with it.)
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/postgres ./node_modules/postgres

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000

# The app answers on / once the server is up; a non-5xx is enough of a liveness
# signal for the orchestrator to stop restarting the container.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
# server.js is emitted by the standalone build. Overridable: anything passed to
# `docker run <image> ...` replaces this and still gets migrations run first.
CMD ["node", "server.js"]
