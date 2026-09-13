# Backend architecture

Warden's backend isn't one app — it's three pieces working together: **api**, **worker**, and a set of shared **packages** they both depend on.

## The pieces

### `apps/api` — NestJS

The REST/WebSocket layer. Handles auth, project/server/service CRUD, and receives deploy requests. Doesn't do heavy lifting itself — when a deploy is triggered, it enqueues a job onto BullMQ and returns immediately. Also hosts the WebSocket gateway (`deploys.gateway.ts`) that streams live deploy logs back to the frontend.

### `apps/worker` — plain TS + BullMQ

Where the actual work happens: SSH into the target server, pull code, build/swap containers, run health checks, roll back on failure. Deliberately kept framework-free (no Nest) since it's a set of job processors, not an HTTP surface — keeps it lean and easy to reason about independently of the api's conventions.

### Shared packages

| Package                  | Purpose                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/db`            | Prisma schema + generated client. Single source of truth for all models — both api and worker import this rather than each managing their own client.                           |
| `packages/ssh-client`    | Thin wrapper around `ssh2` — connection pooling, exec, sftp. This is the most load-bearing package in the whole system; Warden's reliability depends on this layer being solid. |
| `packages/docker-client` | Wrapper around `dockerode` — talks to the remote Docker daemon over the SSH tunnel/socket for container lifecycle (build, swap, health check, rollback).                        |
| `packages/shared-types`  | Zod schemas + inferred TS types shared across api, worker, and frontend — validates payloads crossing process boundaries (HTTP, WS, job payloads).                              |

## How a deploy flows

1. Frontend hits `apps/api` (REST) to trigger a deploy.
2. `api` validates the request (via `shared-types` schemas), writes a `Deploy` record (via `packages/db`), and enqueues a job in BullMQ.
3. `apps/worker` picks up the job, uses `packages/ssh-client` to connect to the target VPS, and `packages/docker-client` to build/swap the container.
4. Worker emits progress back — either by writing status updates to the DB that `api` polls/pushes over WebSocket, or (if wired directly) by publishing to a channel `api`'s gateway subscribes to.
5. Health check runs post-swap; on failure, worker triggers rollback automatically.

## Why this split (not just one Nest app)

Both `api` and `worker` need database and SSH/Docker access. Keeping them as separate apps sharing packages means:

- One schema, one source of truth — no drift between two separate Prisma clients
- `worker` isn't coupled to Nest's request/response lifecycle — it's just job processors
- Either app can scale/restart independently in production

## Auth (decided 2026-09-13)

- Access JWT (15 min, httpOnly cookie, no `role` claim) + opaque refresh token (7 days, httpOnly, path-scoped to `/auth/refresh`, hashed in Redis, rotated on use). `session:{sid}` in Redis is the source of truth; every guarded request verifies the JWT then loads the session — missing session = 401.
- Flows: magic link (token in Redis, 15 min, single use) -> onboarding (password + org name, one transaction, creator becomes `ADMIN`); email + bcrypt password; GitHub / Google OAuth via direct `fetch`; API tokens as bearer (SHA-256 -> `ApiToken.tokenHash`).
- No Passport, no class-validator. `ZodValidationPipe` + schemas from `shared-types`.
- Module layout in `apps/api/src`: `prisma/`, `redis/` (global), `session/` (`SessionService`, `TokenService`), `auth/` (controller, `AuthService`, `OnboardingService`, guards `SessionGuard` / `RolesGuard` / `ApiTokenGuard`, decorators `@Roles` / `@CurrentUser` / `@CurrentOrg`), `mail/`.

## Current state

Monorepo skeleton is built and compiles clean (`pnpm turbo run build`). Not yet wired:

- Prisma schema written and migrated (`init`, `cross_org_guard`); `pnpm infra:up` starts Postgres + Redis from `infra/docker-compose.yml`
- `packages/db` has no `src/index.ts` yet — nothing exports a Prisma client for api/worker to import
- No app yet imports from `db`, `ssh-client`, `docker-client`, or `shared-types` as real workspace dependencies
- Deploy job logic, health-check logic, and rollback logic not yet implemented

See individual READMEs in `apps/api`, `apps/worker`, and each `packages/*` folder for setup specifics.
