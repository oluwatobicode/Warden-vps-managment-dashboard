# Platform admin (super admin) — build plan

Written 2026-11-03. Owner's calls on the open questions: **all yes** — per-org table, active users, churn tracking, Warden's own health.

Read `CLAUDE.md` first. This plan follows its rules: Zod schemas in `shared-types`, thin controllers, every number a `count` / `groupBy` / `aggregate` in Postgres run in parallel (copy the pattern in `apps/api/src/modules/dashboard/dashboard.service.ts`), never return a Prisma model, CommonJS, every FK indexed.

---

## What this is

One page for the platform owner (Tobi) to watch Warden after launch: growth, how far new orgs get, whether deploys work, what infra people connect, and whether Warden's own server is healthy.

## Hard rules (do not bend)

1. **Who can see it:** only a user with `User.platformRole = OWNER`. That value is set **by hand in the database**. No code may ever write `platformRole` — not signup, onboarding, team, or this feature.
2. **Guard reads the DB every request** (`PlatformOwnerGuard`): after `SessionGuard`, load `user.platformRole` by `session.userId`. Not cached in the session record, so removing it by hand works at once.
3. **Not the owner → 404** (`NotFoundException`), not 403, so the routes don't reveal they exist. API tokens never allowed (no `@TokenAllowed()`).
4. **Counts and metadata only.** Never return: variables, secrets, SSH keys, server IPs, logs, deploy logs, commit messages, audit log contents, DB passwords. No impersonation / "log in as". The per-org table shows names and numbers, nothing you could use to touch their infra.
5. Not org-scoped on purpose — this is the one module allowed to query across orgs. Keep it isolated in its own module so that exception is easy to audit.

---

## Step 1 — Schema (one migration)

### 1a. Active users: use the existing `Membership.lastActiveAt`
The column exists but **nothing writes it** today. Don't add a new column; start writing this one (it's per org, which stays correct when multi-org arrives).

### 1b. Churn: `OrganizationTombstone`
Deleting an org cascades everything away, so "orgs that left" can't be counted afterwards. Add a small table written in the same transaction as the org delete:

```
model OrganizationTombstone {
  id               String   @id @default(uuid())
  organizationId   String   // no FK — the org is gone
  orgCreatedAt     DateTime
  deletedAt        DateTime @default(now())
  memberCount      Int
  serverCount      Int
  deployCount      Int
  everDeployedOk   Boolean  // had at least one SUCCESS deploy
  @@index([deletedAt])
}
```
No name, no email (the org asked to be deleted — keep only numbers).

**Note:** there is **no org-delete route in the code yet** (grep finds no `organization.delete`). So: create the table now; when org deletion is built, its transaction (projects first, then org, per CLAUDE.md) must also insert the tombstone. Add that requirement to the org-deletion task. Until then, churn is measured by **dormant orgs** (Step 3, Growth #6).

No other schema changes.

---

## Step 2 — Write `lastActiveAt`

Where: `apps/api/src/common/guards/session.guard.ts` (and the cookie branch of `session-or-token.guard.ts`, not the token branch — a CI token isn't a person).

How, without a DB write per request:
1. Redis `SET last-active:{userId}:{orgId} 1 NX EX 3600`.
2. Only if that SET succeeded → `membership.updateMany({ where: { userId, organizationId }, data: { lastActiveAt: new Date() } })`.
3. Fire-and-forget (`void`, catch + log). A failure must never fail the request.

Don't hang this on `SessionService.touch()` — it only writes when the TTL is low, so it isn't a reliable hourly signal.

Also set it on login (`SessionService.create` callers) so a fresh sign-in counts immediately.

---

## Step 3 — Api module `modules/platform`

Files: `platform.module.ts`, `platform.controller.ts`, `platform.service.ts`, `platform-owner.guard.ts` (in `common/guards/`). Register in `app.module.ts`.

Controller: `@UseGuards(SessionGuard, PlatformOwnerGuard)` on the class. Flat routes:

| Route | Returns |
|---|---|
| `GET /platform/overview` | sections A–D below |
| `GET /platform/orgs?cursor=&sort=` | per-org table (section F), 50 per page |
| `GET /platform/health` | section E |

Zod response schemas in `packages/shared-types/src/platform.ts`, exported from `index.ts`.

### A. Growth
1. Users: total, new in 7d, new in 30d
2. Signups by `authProcess` (EMAIL / GITHUB / GOOGLE)
3. Orgs: total, new 7d, new 30d
4. **Active users** (distinct `userId` in `Membership` with `lastActiveAt` within): 1d (DAU), 7d (WAU), 30d (MAU). Distinct needs `groupBy` on userId + length, or a `$queryRaw` `COUNT(DISTINCT)` — raw is fine here.
5. Orgs by team size: 1 active member vs 2+ (`Membership` groupBy organizationId where status ACTIVE)
6. **Dormant orgs**: no active membership with `lastActiveAt` in 30d AND no deployment in 30d. Note: until Step 2 has run ~30 days, every older org looks dormant — show "tracking since <first lastActiveAt>" under it.
7. **Deleted orgs** (tombstones): 30d count, total, and how many had ever deployed successfully
8. Invitations: pending / accepted (`InvitationStatus`)
9. Signups per day, last 30 days (for a chart) — `$queryRaw` `date_trunc('day', "createdAt")` group.

### B. Activation funnel (per org, counted as "orgs that reached this step")
1. Org created (= total orgs)
2. Has an SSH key
3. Has a server
4. Has a server that was ever reachable (`lastSeenAt` not null)
5. Has a project
6. Has a deployment
7. Has a `SUCCESS` deployment

Each is `organization.count({ where: { <relation>: { some: … } } })`. Plus **median time from org created → first SUCCESS deploy** (`$queryRaw`, `percentile_cont(0.5)` over `min(finishedAt) - org.createdAt` per org).

### C. Deploys
1. Total, last 7d, last 30d; per day for 30 days (chart)
2. 30d by `deploymentStatus` (SUCCESS / FAILED / GATE_FAILED / ROLLED_BACK / CANCELLED) → success rate = SUCCESS ÷ (finished ones)
3. 30d duration p50 / p95 (`finishedAt - startedAt`, only finished rows) — `$queryRaw` `percentile_cont`
4. 30d by `buildMethod` (DOCKERFILE / RAILPACK)
5. 30d by `deploymentType` (MANUAL / AUTOMATED), and rollbacks (`rollbackOfId` not null)
6. 30d deploys started by an API token — `triggeredByName` starts with `token:` (it's the snapshot; check the exact prefix in the deploys module before relying on it)

### D. Infra
1. Servers by `status`; offline > 24h (`status OFFLINE` and `lastSeenAt` < now − 24h or null)
2. Servers by `provider` (free text: lower-case + trim before grouping, top 10 + "other")
3. Servers with the proxy set up (`proxyInstalledAt` not null) vs not
4. Services by `type`; services by `status`
5. Databases by engine + version (`ServiceDatabase`)
6. Backups 30d: SUCCESS vs FAILED
7. **Bytes in Warden's platform bucket**: `sum(sizeBytes)` where `storage = PLATFORM` and `status = SUCCESS` — this one costs Tobi money. Same for `ORG` for comparison. Orgs with their own `BackupStorage`.
8. GitHub App installations (count); services with a custom domain (`ServiceDomain` count)
9. API tokens (count, by scope)

### E. Warden's own health (`/platform/health`)
1. Postgres size: `pg_database_size(current_database())`
2. Biggest tables: `pg_total_relation_size` for `ServiceLog`, `ServerLog`, `ServerMetrics`, `DeploymentLog`, `DockerDiskMetrics`, plus approximate rows from `pg_class.reltuples` (never `count(*)` on these — too slow)
3. Queues: `getJobCounts('waiting','active','failed','delayed')` for every name in `QUEUES` (shared-types). The api already holds `Queue` objects for deploys, databases, backups, cleanup; create a read-only `Queue` for `monitoring` in this module (close it on module destroy).
4. **Worker alive?** Newest `ServerMetrics.createdAt`: if any server exists and it's older than 3 min, the worker's monitoring loop is down. No new heartbeat needed.
5. Log collector: count Redis keys `logs:lease:*` (SCAN, not KEYS) vs number of servers it should cover.
6. Redis memory: `INFO memory` → `used_memory`.

### F. Per-org table (`/platform/orgs`)
Columns: org name, slug, created, member count (active), last active (max `lastActiveAt`), server count (+ offline), project count, service count, deploys 30d, last deploy, has a SUCCESS deploy (yes/no), backup storage (platform/own).

Rules: **no emails, no IPs, no repo URLs**. Paged with a `(createdAt, id)` cursor, default sort newest first; sorts allowed: created, last active, deploys 30d. Use `_count` selects + one grouped query per page for the 30d deploys and last active (no N+1).

### Caching
None at first. If `/platform/overview` gets slower than ~300 ms, cache its JSON in Redis for 60 s (`platform:overview`). Don't build it pre-emptively.

---

## Step 4 — Frontend `features/platform`

1. `SessionUser` gets `isPlatformOwner: boolean` (filled in the mapper from `user.platformRole === 'OWNER'`). It only decides whether to show the link — the api guard is the real check.
2. Route `/platform` **outside** the org console layout, inside `RequireAuth`. A small `RequirePlatformOwner` guard renders `NotFoundPage` for everyone else (same as the api's 404).
3. Link: one entry in the account/user menu, only when `isPlatformOwner`.
4. Page tabs: **Overview · Organizations · Warden health**
   - Overview: stat tiles (A, C, D headline numbers), funnel as horizontal bars with the drop between steps, signups/day and deploys/day line charts, success-rate breakdown.
   - Organizations: the table from F, infinite/paged.
   - Warden health: E, with red states for "worker loop silent > 3 min", failed jobs > 0, Postgres over a threshold.
5. TanStack Query, `staleTime` 60 s, a refresh button. No sockets.
6. Charts: whatever the dashboard already uses; don't add a chart library if one exists. If none exists, ask Tobi before adding one.

---

## Step 5 — Tests and checks

1. Guard: no session → 401; session but `platformRole` null → **404**; OWNER → 200. Flip `platformRole` to null in the DB → next request 404 (proves no caching).
2. API token in `Authorization: Bearer` on `/platform/*` → 401/404, never 200.
3. Response schemas parse with the Zod schemas (and contain no email/IP fields — assert on the keys).
4. `lastActiveAt`: two requests in a row → one DB write (Redis NX works).
5. Note: the api's Jest can't load NestJS 12 yet (see CLAUDE.md), so guard tests may have to run against the live api like the token guard was.
6. Run `/platform/overview` against a DB with realistic rows and check the timing.

## Step 6 — Docs

Add a short "Platform admin (built <date>)" entry to `CLAUDE.md` with the rules above, and the tombstone requirement to whatever task builds org deletion.

---

## Out of scope (don't build)
- Impersonation / log in as a user
- Viewing any org's servers, variables, logs or settings
- Editing or deleting orgs/users from this page
- Signup source / UTM tracking
- Emailed or scheduled reports
- 7d/30d history tables for any metric (computed live from existing rows instead)
