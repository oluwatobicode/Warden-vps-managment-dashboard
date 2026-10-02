# CLAUDE.md — Warden

This file governs how Claude works in this repository. Read it fully at the start of every session before writing anything.

---

## What this project is

Warden is a **self-hosted VPS deployment control plane**. Users connect their own servers and deploy projects to them via direct SSH (v1 approach — not agent-based), with the platform handling build → health-check → container swap → rollback as one flow, all from a dashboard.

Deliberately narrower in scope than tools like Coolify/Dokploy. Native integration with Argus (a separate observability tool built by the same owner) is planned but explicitly deferred past Phase 1.

Projects are **organization-scoped**. Phase 1 is single-org-per-user; `Membership` (the join table between `User` and `Organization`) is the **only** source of truth for which org a user belongs to — `User` deliberately has no `organizationId`. Multi-org later just means allowing more than one `Membership` row per user — not a schema rewrite.

---

## The working rules (follow these every time)

These are the rules the project owner set. They are not optional.

1. **The owner writes the code.** Claude's job is architecture guidance, code review, and honest technical critique — not producing implementation code unless explicitly asked to.
2. **Push back, directly.** If something is technically wrong, contradicts an earlier decision, or reintroduces a problem already fixed once, say so plainly. Don't soften it into a vague caveat and don't quietly go along with it.
3. **Don't fill gaps with assumptions.** If a requirement or a piece of the schema is ambiguous or missing, flag it as an open question. Don't silently pick an answer and move forward as if it were settled.
4. **Respect the final call, once made.** If the owner hears the tradeoff and still chooses a path Claude pushed back on (e.g. NestJS over plain Express), state the honest tradeoff once, then commit to that decision and stop relitigating it in later responses — unless new information changes the picture.
5. **Don't over-engineer.** Build what the current phase actually needs. Flag future-proofing opportunities (like the `Membership` shape above) when they're free, but don't design for problems that don't exist yet — Phase 1's schema explicitly excludes billing, branding, and Argus integration for this reason.
6. **Explain the reasoning, not just the answer.** Especially for architecture/tooling calls — the owner is actively weighing tradeoffs (e.g. resume value vs. technical fit), not just asking for a decision to be handed over.
7. **PLAN FIRST, WHEN OWENER GIVES APPROVAL START IT**
8. **ALWAYS ASK QUESTIONS WHEN NOT SURE**

---

## Monorepo structure

pnpm + Turborepo. See `docs/BACKEND.md` for the full architecture writeup of how these pieces fit together.

```
warden/
├── apps/
│   ├── api/          # NestJS — REST/WS layer, deploy orchestration, enqueues jobs
│   ├── worker/         # plain TS + BullMQ — where deploys actually run (SSH, Docker, health checks, rollback)
│   └── frontend/         # Vite + React — dashboard UI
├── packages/
│   ├── db/               # Prisma schema + client — single source of truth, shared by api + worker
│   ├── ssh-client/         # ssh2 wrapper — connection pooling, exec, sftp
│   ├── docker-client/       # dockerode wrapper — remote Docker daemon control
│   └── shared-types/          # zod schemas + inferred types, shared across all three apps
├── infra/
├── docs/
│   ├── BACKEND.md              # architecture overview
│   └── PHASE-1-CORE-FLOW.md      # current phase's user flow spec — updated phase by phase
├── turbo.json
└── pnpm-workspace.yaml
```

**Why `api` and `worker` are separate apps, not one Nest app:** both need DB, SSH, and Docker access. Splitting them means one schema (no drift between two clients), `worker` isn't coupled to Nest's request/response lifecycle (it's job processors, not HTTP handlers), and either can scale/restart independently in production.

**Why `ssh-client` and `docker-client` are separate packages, not one "remote" package:** SSH is transport, Docker is orchestration. Keeping them independent means either can be tested/mocked separately, and `docker-client` could be swapped out later if the direct-SSH-vs-agent decision changes.

---

## Stack

- **api:** NestJS, CommonJS, Jest for testing
- **worker:** plain TypeScript, CommonJS, BullMQ + ioredis, no framework — deliberately, since it's job consumers, not an HTTP surface
- **frontend:** Vite + React + TypeScript, Tailwind CSS v4 (`@tailwindcss/vite` — no `tailwind.config.js`/PostCSS), Hugeicons, React Router, React Hook Form + Zod + `@hookform/resolvers`, TanStack Query + Axios, Zustand (only added when a piece of state genuinely needs it beyond React Query's cache), Socket.io-client for live deploy log streaming, Vitest for testing (matches Vite's transform pipeline — Jest doesn't)
- **db:** Prisma **v7** (stable) — not v8, which is still an rc rewrite with no stable matching `@prisma/client` published. Revisit once v8 is GA.
- **Database:** PostgreSQL, via `@prisma/adapter-pg` driver adapter
- **Sessions / auth tokens:** Redis — not a Postgres model. Decided shape (owner's call, do not relitigate): short-lived access **JWT** (15 min, httpOnly cookie, carries `sub`, `sid`, `org`, `jti` — **never `role`**) plus an opaque **refresh token** (7 days, httpOnly cookie path-scoped to `/auth/refresh`, stored **hashed** in Redis, rotated on every use, reuse of a rotated token revokes the whole session family). Redis keys: `session:{sid}` (source of truth, sliding 7-day TTL refreshed at most hourly), `refresh:{tokenHash}`, `user-sessions:{userId}`. Every guarded request verifies the JWT **and** loads `session:{sid}` — a missing session is a 401, which is the revocation check. Role is read from the session record so demotion is instant.
- **Mail:** Resend, via `MailService` (`RESEND_API_KEY`, `MAIL_FROM`). When the key is empty the service logs the link to the console instead of sending — keeps fresh clones and tests mail-free.
- **Password reset (owner's call, 2026-09-30):** a 6-digit OTP emailed via `MailService.sendPasswordResetCode`, verified before a new password is set. Magic-link *sign-in* stays OTP-free as the Phase 1 doc says; the OTP is only for the reset flow. Tradeoff noted once: it duplicates what a magic link already provides and adds a brute-forceable code that needs rate limiting and a short TTL.
- **Auth libraries:** no Passport, no `class-validator`. Magic-link, password (bcrypt, cost 12, password schema capped at 72 bytes), GitHub and Google OAuth are implemented directly in `AuthService` (OAuth = two `fetch` calls per provider). Magic-link tokens live in Redis with a 15-minute TTL, single use.
- **Request validation:** a `ZodValidationPipe` applied per-handler with schemas from `shared-types`. Same schema validates the React Hook Form on the frontend and the request body on the API. Response shapes are also Zod schemas — never return a Prisma model from a controller (`User.passwordHashed`, `SshKey.privateKeyEncrypted`, `ApiToken.tokenHash` must never leak).
- **Reverse proxy on target servers:** Traefik or Caddy, for zero-downtime container swaps (reference: how Coolify/Dokploy pair these with their deploy pipelines)

---

## The permission model

Roles (`Role` enum on `Membership`, per-org — not global on `User`), four of them, decided 2026-10-02. The line between each pair is "can this break something that isn't yours":

| | `VIEWER` | `DEVELOPER` | `DEV_OPS` | `ADMIN` |
|---|---|---|---|---|
| View everything | yes | yes | yes | yes |
| Add/edit services and variables; deploy; rollback | | yes | yes | yes |
| Create/delete projects and environments; servers, SSH keys, Traefik | | | yes | yes |
| Team, invitations, roles, API tokens, notifications, org settings, org deletion | | | | yes |

`VIEWER` is the default for new memberships. `DEPLOYER` was removed (2026-10-02): "can deploy" is a permission `DEVELOPER` has, not a job title. In code this is one `@Roles(...)` per controller class with per-route overrides. Separate `PlatformRole` enum (`OWNER`) exists on `User` for the platform operator's own account — unrelated to org role, nullable, not something every user carries.

**API shape (decided 2026-10-02): flat controllers, not nested URLs.** `/projects`, `/environments`, `/services` are each top-level; a child names its parent in the body (`environmentId`) and lists filter by query (`GET /services?environmentId=…`). The composite FKs already guarantee cross-org integrity, so each handler needs only the one org-scoped lookup. No `/projects/:id/environments/:id/services/:id` chains.

**Non-negotiable tenancy rule:** every org-scoped query filters by `organizationId` resolved from the authenticated session — never trust an `organizationId` passed in a request body. The database backs this up: `Environment`, `Service`, `Server`, `SshKey` and `ApiToken` carry `organizationId`, and their cross-model relations are **composite foreign keys on `(id, organizationId)`**, so Postgres itself rejects a Service pointing at another org's Server, a Server using another org's key, or a token scoped to another org's project. When creating an `Environment` or `Service`, set `organizationId` from the session explicitly; a wrong value fails with P2003 instead of silently succeeding. `AuditLog` is the one exception (single-column FKs to `User`/`ApiToken` with `SetNull`) because a composite FK with `SetNull` would try to null `organizationId` — audit rows are server-written from session context, never from request input, so app-level enforcement is acceptable there.

The org creator's membership is created with role `ADMIN` in the same transaction as the org — otherwise nobody can manage it.

**`PlatformRole.OWNER` is never assigned by code.** It is set by hand in the database for the project owner only, and gates a platform-wide stats view (cross-org counts for launch monitoring). No signup, onboarding or admin flow may set it. The only code that reads it is a `PlatformOwnerGuard` on those stats routes.

---

## Data model status (Phase 1)

Schema covers: auth (`User`, `AuthProvider`, platform role), org structure (`Organization`, `Membership`, `Invitation`), projects (`Project` → `Environment` → `Service` → `Deployment` → `DeploymentHistory`), servers (`Server` + `ServerMetrics`, `ServerContainer`, `ServerLogs`, `ServerTraefik`, `DockerCleanupLog`, `DockerDiskMetrics`), `SshKey`, `ApiToken` (org-scoped, optionally project-scoped), `NotificationChannel` (Slack/Email/Discord via one model with a type enum), `AuditLog`.

**Schema decisions from the design pass (2026-10-01), all additive and migrated:** the GitHub repo lives on `Service` (`githubRepoUrl`, `branch`), NOT on `Project` — a project is a product, a service is one deployable thing from one repo, and two services may share a repo. `Service.type` is `APPLICATION | WORKER | DATABASE | COMPOSE`; only the first two are built in Phase 1, the others are reserved for the UI. Env vars are two models, `EnvironmentVariable` (environment-wide) and `ServiceVariable` (per-service, overrides on the same key), values encrypted at the app layer like SSH private keys, both carrying `organizationId` with composite FKs. `Deployment.number` is a per-org counter driven by `Organization.deployCounter` inside the deploy-creation transaction; `Deployment.organizationId` exists so the dashboard's recent-deploys query is one table. `Organization.slug` is generated at onboarding by `uniqueSlug()` (slugified name + 6-char suffix, so no retry loop). `DeploymentStatus` is the full pipeline: `QUEUED, BUILDING, DEPLOYING, HEALTH_CHECK, SUCCESS, GATE_FAILED, ROLLED_BACK, FAILED, CANCELLED`. `Server.provider` is a free-text display label.

**Cascade deletes are explicit and destructive by design for Phase 1:** deleting an `Organization` cascades through everything under it (projects, servers, keys, tokens, memberships, invitations, notification channels). No soft-delete, no grace period. This was a deliberate call, not a Prisma default left unexamined — revisit before this handles real customer infra if a grace period is wanted instead.

**Restrict relations (delete blocked, catch Prisma `P2003` and tell the user what still references the row):** `Server -> SshKey`, `Service -> Server`, `Membership -> User`. **Org deletion must delete the org's `Project`s first, then the `Organization` row, in one transaction** — a single-statement org delete fails whenever a Service is still assigned to a Server (verified against Postgres: Service is 3 hops from Organization, Server is 1, so the Restrict check fires before the cascade reaches Service). `AuditLog` rows survive deletion of their actor via `SetNull` plus snapshot columns (`performedByEmail`, `performedByRole`, `apiTokenName`).

**Team membership decisions (2026-09-30):** removing a member sets `Membership.status = SUSPENDED` and destroys their sessions — never a hard delete. Because `Membership` is unique on `(userId, organizationId)`, re-inviting a suspended person must reactivate the existing row, not create one. `Invitation` has its own `InvitationStatus` enum (`PENDING | ACCEPTED | EXPIRED | REVOKED`); "one pending invite per email per org" is enforced in the service, not by a unique constraint, so expired invites can be re-sent.

**Every FK column is indexed** (Postgres and Prisma don't do this automatically); time-series children index `(serverId, createdAt)`. Keep that rule when adding models.

**Explicitly deferred, not in the schema:** Argus integration, billing/plan, branding.

---

## Coding conventions

- **Thin controllers/handlers, logic in services** — same principle regardless of which app: `api`'s Nest controllers stay thin, business logic and Prisma queries live in services.
- **Validate at the edge.** Zod schemas (via `shared-types` where the shape crosses a process boundary — HTTP, WebSocket, or BullMQ job payload) validate before anything downstream trusts the data.
- **CommonJS across `api`, `worker`, and all `packages/*`, including `packages/db`** (generator `moduleFormat = "cjs"`, built to `dist/` — apps consume the build, never the `.ts` source, because plain Node can't resolve TypeScript's `.js`→`.ts` mapping at runtime). `frontend` is the only ESM context (Vite's default). Don't mix `moduleResolution: "Node"` with `module: "NodeNext"` — TS7 requires them paired (`NodeNext`/`NodeNext` or matching CJS settings); this has broken builds before in this repo.
- **One schema, one client.** `api` and `worker` both consume `packages/db` — never let either app manage its own separate Prisma client.
- **Time-series data gets its own model**, never flattened onto the parent (e.g. `ServerMetrics` rows over time, not scalar `cpu`/`memory` fields directly on `Server`).

---

## Open items (do not build past these without confirmation)

- **Cookie policy:** `SameSite=Lax` if frontend and API share a site in production, otherwise `SameSite=None; Secure` + CORS with credentials. Depends on how Warden itself will be deployed — undecided.
- **OAuth onboarding state:** new GitHub/Google users still need the org-name step. Preferred: hold the OAuth identity in Redis until onboarding completes, then create `User` + `Organization` + `Membership` together (no orphan users). Not yet confirmed.

- **Traefik dynamic config editing:** raw text editor with validate-before-apply, or a structured form limited to safe fields? Unresolved — a bad direct edit can break live routing.
- **Metrics history window:** Phase 1 ships 24h only. 7d/30d/all-time are deferred until the 24h collection pipeline (recurring poll + storage) is proven — don't build retention tiers for data collection that doesn't exist yet.
- **GitHub/Google OAuth users setting an optional password as a fallback login:** not decided.

---

## Default posture for Claude

When asked to review or help design something in this repo: check it against what's already decided here and in `docs/PHASE-1-CORE-FLOW.md` and `docs/BACKEND.md` first. Flag contradictions or regressions (a role that dropped out of an enum again, a relation that reintroduces a fixed problem) directly and specifically — cite what changed and why it matters. Don't write implementation code unless asked. Explain the reasoning behind any technical pushback, not just the correction itself.
