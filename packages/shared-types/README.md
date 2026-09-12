# @warden/shared-types

Zod schemas and inferred TypeScript types shared across `apps/api`, `apps/worker`, and `apps/frontend`. Used to validate payloads crossing process boundaries — HTTP requests/responses, WebSocket messages, and BullMQ job payloads.

## Why zod-first (not just interfaces)

Warden has data crossing several boundaries at runtime (API ↔ frontend, API ↔ worker via queue, worker ↔ target server via SSH/Docker responses). Plain TS interfaces give compile-time safety only; zod schemas give runtime validation _and_ infer the TS types from the same definition, so there's one source of truth per shape instead of a type and a validator drifting apart.

## Stack

- `zod`
- **Module system**: CommonJS

## Structure (planned)

```
src/
├── deploy.schema.ts     # deploy job payloads, deploy status
├── server.schema.ts       # server registration payloads
├── service.schema.ts        # service config payloads
└── index.ts                   # re-exports
```

## Setup

```bash
pnpm install
```

## Build

```bash
pnpm run build     # tsc -> dist/
pnpm run dev         # tsc --watch
```

## Consuming this package

```bash
pnpm add @warden/shared-types --workspace
```

## Status

Scaffolded shell only — builds clean, no schemas defined yet. Will follow once `packages/db`'s Prisma schema is written, since many of these shapes will mirror (or be derived from) the DB models.
