# syntax=docker/dockerfile:1.7
#
# Warden's two images, built from the repo root:
#   app  api AND worker (one image, two commands: they share every dependency)
#   web  the dashboard's static files, served by Caddy
# Built natively per CPU (amd64, arm64) by .github/workflows/images.yml.
# Nothing is built on the server Warden runs on: a small instance runs out of memory.

ARG NODE_VERSION=24.18.0

FROM node:${NODE_VERSION}-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true \
    npm_config_fetch_timeout=300000 npm_config_fetch_retries=5 \
    pnpm_config_fetch_timeout=300000 pnpm_config_fetch_retries=5
# Compilers only in case a native module (bcrypt, ssh2) has no prebuilt binary for this CPU.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
 && npm install -g pnpm@11.26.0
WORKDIR /app
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
# Production: the dashboard and the api share one address, the api under /api.
ENV VITE_API_URL=/api
RUN pnpm turbo run build --filter=api --filter=worker --filter=frontend
RUN mv apps/frontend/dist /web
# A clean tree with only what the api and worker run: every manifest (so the
# lockfile still matches), their built code, Prisma's migrations, and the
# production dependencies of api + worker alone (not the dashboard's icons,
# not TypeScript or Turbo).
RUN mkdir /out && cp package.json pnpm-lock.yaml pnpm-workspace.yaml /out/ \
 && for d in apps/* packages/*; do \
      mkdir -p "/out/$d" && cp "$d/package.json" "/out/$d/"; \
      if [ "$d" != apps/frontend ] && [ -d "$d/dist" ]; then cp -r "$d/dist" "/out/$d/"; fi; \
    done \
 && cp -r packages/db/prisma packages/db/prisma7.config.ts /out/packages/db/
WORKDIR /out
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod --filter=api... --filter=worker...

FROM node:${NODE_VERSION}-slim AS app
# openssl: Prisma's migration engine needs it.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tini && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out /app
USER node
LABEL org.opencontainers.image.source="https://github.com/oluwatobicode/Warden-vps-managment-dashboard"
# tini: forwards SIGTERM so the worker's shutdown (finish jobs, release log leases) runs.
ENTRYPOINT ["tini", "--"]
CMD ["node", "--enable-source-maps", "apps/api/dist/main.js"]

FROM caddy:2.10-alpine AS web
COPY infra/production/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /web /srv
LABEL org.opencontainers.image.source="https://github.com/oluwatobicode/Warden-vps-managment-dashboard"
