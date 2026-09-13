# CLAUDE.md — Warden

This file governs how Claude works in this repository. Read it fully at the start of every session before writing anything.

---

## What this project is

Warden is a **self-hosted VPS deployment control plane**. Users connect their own servers and deploy projects to them via direct SSH (v1 approach — not agent-based), with the platform handling build → health-check → container swap → rollback as one flow, all from a dashboard.

Deliberately narrower in scope than tools like Coolify/Dokploy. Native integration with Argus (a separate observability tool built by the same owner) is planned but explicitly deferred past Phase 1.

Projects are **organization-scoped**. Phase 1 is single-org-per-user; the schema (`Membership` as the join table between `User` and `Organization`) is already shaped so multi-org later just means allowing more than one `Membership` row per user — not a schema rewrite.

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
- **Sessions:** Redis — not a Postgres model. Fast reads per request, TTL expiry for free, instant revocation by key deletion.
- **Reverse proxy on target servers:** Traefik or Caddy, for zero-downtime container swaps (reference: how Coolify/Dokploy pair these with their deploy pipelines)

---

## The permission model

Roles (`Role` enum on `Membership`, per-org — not global on `User`): `ADMIN` (org administrator: team, servers, keys, org settings, org deletion), `DEV_OPS`, `DEPLOYER`, `DEVELOPER`, `VIEWER` (default for new memberships — least privilege). Separate `PlatformRole` enum (`OWNER`) exists on `User` for the platform operator's own account — unrelated to org role, nullable, not something every user carries.

**Open, not yet resolved:** the exact permission boundary between `DEPLOYER` and `DEV_OPS` (e.g. does `DEV_OPS` get SSH key/server management that `DEPLOYER` doesn't?). Do not silently assume a split — this needs a decision before it's baked into route guards.

**Non-negotiable tenancy rule:** every org-scoped query filters by `organizationId` resolved from the authenticated session — never trust an `organizationId` passed in a request body.

---

## Data model status (Phase 1)

Schema covers: auth (`User`, `AuthProvider`, platform role), org structure (`Organization`, `Membership`, `Invitation`), projects (`Project` → `Environment` → `Service` → `Deployment` → `DeploymentHistory`), servers (`Server` + `ServerMetrics`, `ServerContainer`, `ServerLogs`, `ServerTraefik`, `DockerCleanupLog`, `DockerDiskMetrics`), `SshKey`, `ApiToken` (org-scoped, optionally project-scoped), `NotificationChannel` (Slack/Email/Discord via one model with a type enum), `AuditLog`.

**Cascade deletes are explicit and destructive by design for Phase 1:** deleting an `Organization` cascades through everything under it (projects, servers, keys, tokens, memberships, invitations, notification channels). No soft-delete, no grace period. This was a deliberate call, not a Prisma default left unexamined — revisit before this handles real customer infra if a grace period is wanted instead.

**Explicitly deferred, not in the schema:** Argus integration, billing/plan, branding.

---

## Coding conventions

- **Thin controllers/handlers, logic in services** — same principle regardless of which app: `api`'s Nest controllers stay thin, business logic and Prisma queries live in services.
- **Validate at the edge.** Zod schemas (via `shared-types` where the shape crosses a process boundary — HTTP, WebSocket, or BullMQ job payload) validate before anything downstream trusts the data.
- **CommonJS across `api`, `worker`, and all `packages/*`.** `frontend` is the only ESM context (Vite's default). `packages/db` is ESM to match Prisma v7's quickstart requirements. Don't mix `moduleResolution: "Node"` with `module: "NodeNext"` — TS7 requires them paired (`NodeNext`/`NodeNext` or matching CJS settings); this has broken builds before in this repo.
- **One schema, one client.** `api` and `worker` both consume `packages/db` — never let either app manage its own separate Prisma client.
- **Time-series data gets its own model**, never flattened onto the parent (e.g. `ServerMetrics` rows over time, not scalar `cpu`/`memory` fields directly on `Server`).

---

## Open items (do not build past these without confirmation)

- **Traefik dynamic config editing:** raw text editor with validate-before-apply, or a structured form limited to safe fields? Unresolved — a bad direct edit can break live routing.
- **`DEPLOYER` vs `DEV_OPS` permission split:** unresolved, see permission model above.
- **Metrics history window:** Phase 1 ships 24h only. 7d/30d/all-time are deferred until the 24h collection pipeline (recurring poll + storage) is proven — don't build retention tiers for data collection that doesn't exist yet.
- **GitHub/Google OAuth users setting an optional password as a fallback login:** not decided.

---

## Default posture for Claude

When asked to review or help design something in this repo: check it against what's already decided here and in `docs/PHASE-1-CORE-FLOW.md` and `docs/BACKEND.md` first. Flag contradictions or regressions (a role that dropped out of an enum again, a relation that reintroduces a fixed problem) directly and specifically — cite what changed and why it matters. Don't write implementation code unless asked. Explain the reasoning behind any technical pushback, not just the correction itself.
