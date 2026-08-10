# ---------------------------------------------------------------------------
# Recoding Medicine Matchmaker — production image
#
# Multi-stage build for the pnpm monorepo. The final image is the Next.js
# standalone bundle plus the seed data, running as a non-root user, with the
# SQLite database on a mounted volume (/data). Debian slim, not Alpine, so
# the better-sqlite3 native module uses its glibc prebuilds.
# ---------------------------------------------------------------------------

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable

# ---- dependencies ---------------------------------------------------------
FROM base AS deps
WORKDIR /app
# Native toolchain in case better-sqlite3 has to compile from source.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/schema/package.json packages/schema/
COPY packages/matching/package.json packages/matching/
RUN pnpm install --frozen-lockfile

# ---- build ----------------------------------------------------------------
FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 \
    STANDALONE=1
RUN pnpm --filter @rmm/web build

# ---- runtime --------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/data/app.db \
    SEED_ON_EMPTY=true

# The standalone output preserves the monorepo layout: server.js lives at
# apps/web/server.js and expects static assets alongside it.
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
# Synthetic seed data for first-boot auto-seeding (SEED_ON_EMPTY).
COPY --chown=node:node seed ./seed

RUN mkdir -p /data && chown node:node /data
VOLUME /data

USER node
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
