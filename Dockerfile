# ParkSpot — production image.
# Multi-stage: deps -> builder -> runner. The final image ships only the Next.js
# standalone bundle (next.config.ts sets output: "standalone"), so it carries the
# server, its traced node_modules and nothing else — no source, no dev deps.

# ---------- deps: install production + build dependencies once ----------------
FROM node:22-alpine AS deps
WORKDIR /app

# Alpine's musl needs libc6-compat for some native deps (@node-rs/argon2).
RUN apk add --no-cache libc6-compat

# Only the manifests, so this layer is cached until dependencies actually change.
COPY package.json package-lock.json ./
RUN npm ci

# ---------- builder: compile the Next.js app ---------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Telemetry off: the build must not phone home from CI or from a customer's VPS.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# NEXT_PUBLIC_* is inlined into the client bundle at build time, so it has to be
# present here — not just at runtime. Override with:
#   docker build --build-arg NEXT_PUBLIC_APP_URL=https://parkspot.pl .
ARG NEXT_PUBLIC_APP_URL="http://localhost:3000"
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

RUN npm run build

# ---------- runner: minimal runtime image ------------------------------------
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

# Static assets and public files are NOT part of the standalone bundle —
# they have to be copied next to it explicitly.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# The app answers on / once the server is up; a 200/3xx is enough of a liveness
# signal for the orchestrator to stop restarting the container.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

# server.js is emitted by the standalone build.
CMD ["node", "server.js"]
