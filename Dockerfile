# ---------------------------------------------------------------------------
# Foresight Matchmaking — production image
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
    DATABASE_PATH=/data/app.db

# The standalone output preserves the monorepo layout: server.js lives at
# apps/web/server.js and expects static assets alongside it.
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
# Seed files stay in the image so a rehearsal host can opt in with
# SEED_ON_EMPTY=true. Production must leave that unset.
COPY --chown=node:node seed ./seed

COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p /data && chown node:node /data
VOLUME /data

# Deliberately still root here: the entrypoint claims the bind-mounted volume
# and then drops to uid 1000 (node) via setpriv. The app never runs as root.
EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "apps/web/server.js"]
