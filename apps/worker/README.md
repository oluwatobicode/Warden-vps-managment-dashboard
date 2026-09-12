# @warden/worker

Plain TypeScript + BullMQ job processors for Warden. This is where deploys actually happen — SSH into the target server, build/swap containers, health-check, roll back on failure. See [`docs/BACKEND.md`](../../docs/BACKEND.md) for how this fits with `api` and the shared packages.

## Why no framework here

`apps/api` uses NestJS because it's an HTTP/WS surface with a lot of cross-cutting concerns (auth, DI, modules). `worker` is a set of job consumers with a much simpler shape — plain BullMQ processors reading from a queue. Adding Nest here would mean fighting its request-lifecycle assumptions for something that isn't a request lifecycle at all.

## Responsibilities

- Consume deploy jobs enqueued by `apps/api`
- Use `@warden/ssh-client` to connect to the target VPS
- Use `@warden/docker-client` to build/swap containers on the remote Docker daemon
- Run health checks post-swap
- Roll back automatically on health-check failure
- Write job status/progress back via `@warden/db` (and/or push to a channel `api`'s WS gateway subscribes to)

## Stack

- **Language**: TypeScript, compiled with `tsc`, run in dev via `tsx watch`
- **Module system**: CommonJS
- **Queue**: BullMQ + ioredis
- **Testing**: Jest

## Structure

```
src/
├── index.ts
├── processors/
│   ├── deploy.processor.ts
│   ├── health-check.processor.ts
│   └── rollback.processor.ts
├── queues/           # queue definitions consumed here
└── ...
```

## Setup

```bash
pnpm install
```

Requires Redis running and reachable (same instance `apps/api`'s BullMQ producer connects to), plus the same `DATABASE_URL` as `packages/db`.

## Running

```bash
pnpm run dev      # tsx watch src/index.ts
pnpm run build     # tsc -> dist/
pnpm run start      # node dist/index.js
```

## Status

Scaffolded, boots clean (`worker booting...` on `pnpm run dev`), builds clean via `tsc`. No processors implemented yet — pending the Prisma schema and `ssh-client`/`docker-client` wiring.
