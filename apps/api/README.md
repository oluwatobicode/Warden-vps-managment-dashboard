# @warden/api

NestJS REST/WebSocket API for Warden. See [`docs/BACKEND.md`](../../docs/BACKEND.md) for how this fits with `worker` and the shared packages.

## Responsibilities

- Auth, users, teams & roles
- Project / server / service CRUD
- Receiving deploy requests and enqueuing them for `apps/worker`
- WebSocket gateway for live deploy log streaming to the frontend (Socket.io)
- Argus integration endpoints
- Billing

## Stack

- **Framework**: NestJS (CommonJS)
- **Testing**: Jest (Nest default)
- **Realtime**: Socket.io (`@nestjs/websockets` gateway)
- **Queue producer**: BullMQ (`@nestjs/bullmq`) — enqueues jobs; `apps/worker` consumes them
- **Validation**: `@nestjs/config` with a validated schema for env vars

## Structure

```
src/
├── main.ts
├── app.module.ts
├── config/          # validated env config
├── common/           # cross-cutting: guards, filters, interceptors, decorators
├── modules/           # one folder per domain — controller, service, dto colocated
│   ├── auth/
│   ├── users/
│   ├── projects/
│   ├── servers/
│   ├── services/
│   ├── deploys/         # includes deploys.gateway.ts for live log streaming
│   ├── argus-integration/
│   ├── teams/
│   └── billing/
└── queues/             # BullMQ producers (job .add() calls)
```

## Setup

```bash
pnpm install
```

Requires a `.env` — see `packages/db` for the `DATABASE_URL` this app depends on, plus Redis connection details for the BullMQ producer.

## Running

```bash
pnpm run start:dev    # watch mode
pnpm run build         # production build (nest build)
pnpm run start:prod      # run built output
```

## Status

Scaffolded via `nest new`, boots clean with default route. Domain modules (`auth`, `projects`, `servers`, etc.) not yet implemented — this is the next step once `packages/db`'s schema is written.
