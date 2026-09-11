# Warden

A self-hosted VPS deployment control plane — connect your servers, deploy projects via direct SSH, and manage the full lifecycle (build, health-check, swap, rollback) from a single dashboard.

## Why

Deploying to your own VPS usually means either hand-rolling SSH/Docker scripts, or adopting a heavier PaaS. Warden aims for the middle: a focused, self-hosted control plane — narrower in scope than tools like Coolify/Dokploy, with native [Argus](../argus) integration for observability from day one.

## Monorepo layout

```
warden/
├── apps/
│   ├── api/          # NestJS — REST/WS API, deploy orchestration
│   ├── worker/        # BullMQ consumers — deploy jobs, health checks, rollbacks
│   └── frontend/       # Vite + React — dashboard UI
├── packages/
│   ├── db/             # Prisma schema + client, shared across api/worker
│   ├── ssh-client/       # ssh2 wrapper — connection pooling, exec, sftp
│   ├── docker-client/     # dockerode wrapper — remote Docker daemon control
│   └── shared-types/       # zod schemas + inferred types, shared across apps
├── infra/               # Dockerfiles, compose, self-deploy config
├── docs/
│   └── BACKEND.md         # architecture overview: how api/worker/db fit together
├── turbo.json
└── pnpm-workspace.yaml
```

Each `apps/*` and `packages/*` folder has its own README with setup and run instructions specific to that piece. Start with [`docs/BACKEND.md`](./docs/BACKEND.md) for the backend architecture, or jump straight into a folder's README.

## Prerequisites

- Node.js 24+
- pnpm (workspace-managed — see `pnpm-workspace.yaml`)
- PostgreSQL (for `packages/db`)
- Redis (for BullMQ, used by `apps/worker`)

## Getting started

```bash
pnpm install
pnpm turbo run build
```

To run everything in dev mode, open a terminal per app:

```bash
# api
cd apps/api && pnpm run start:dev

# worker
cd apps/worker && pnpm run dev

# frontend
cd apps/frontend && pnpm run dev
```

## Status

Actively being scaffolded — core monorepo skeleton is in place (all apps/packages build clean via `pnpm turbo run build`). Schema, cross-package wiring, and actual deploy logic are in progress.

## Stack

- **Backend**: NestJS (api), plain TypeScript + BullMQ (worker), Prisma + PostgreSQL, Redis
- **Frontend**: Vite + React + TypeScript + Tailwind v4
- **Infra targets**: direct-SSH to VPS (v1), Docker via `dockerode`, Traefik/Caddy for zero-downtime swaps
