# Phase 1 — Core Flow

This document describes the first phase of Warden's user-facing flow: getting a user signed up, oriented, and able to configure the pieces (servers, SSH keys, team, tokens) needed before any real deploy happens. It does **not** cover actual deploy execution, build/swap logic, or Argus integration — those are later phases.

Read this alongside [`docs/BACKEND.md`](./BACKEND.md) for how the pieces described here map onto `apps/api`, `apps/worker`, and the shared packages. This doc will be updated phase by phase as the project moves — treat it as the current source of truth for "what does the app do right now," not a permanent spec.

## Goal of Phase 1

A user can sign up, land in a working dashboard shell, create a project, register a server, add SSH keys, invite teammates, and issue API tokens. Nothing here triggers a real deploy yet — this phase is about the scaffolding a deploy will eventually run inside.

---

## 1. Auth flow

Entry point: **Sign in with email** or **Sign in with GitHub**.

### Email flow

1. User enters email, clicks "sign in with email."
2. A secure (magic) link is sent — no OTP, no separate verify step. This is deliberate: the link itself _is_ the verification.
3. User clicks the link, lands on a screen to set:
   - Password
   - Organisation name
   - "Email verified" status shown at the top (already true, by virtue of having clicked the link)
4. Account is created **and the user is immediately logged in** — no second login prompt. They set a password here for _future_ sign-ins, not to unlock this one.

### GitHub / Google flow

- Separate flow from email — OAuth handles identity + verification implicitly. No password step needed (unless we later want an optional password for users who also want email/password as a fallback — not decided for Phase 1).

---

## 2. Home page

Three top-level pages once logged in: **Home**, **Projects**, **Settings**.

Home shows:

- **4 metric cards**: Projects, Services, Total Deploys, Servers Connected
- **Recent Deployments table**:
  | Column | Notes |
  |---|---|
  | ID | |
  | Deployment name | |
  | Project/branch | Format: `Argus/Production` |
  | Status | `deploying`, `healthy`, `degraded` |
  | Time last deployed | |

Status shown per-row here is the deployment's own status, not a rollup — rollups apply at the project-card level (see below).

---

## 3. Projects page

### Project cards

- Project name (e.g. `Argus`)
- Slug (e.g. `/argus`)
- Total services (e.g. `8 services`)
- Environments (a project can have multiple — see below)
- Status: `deploying`, `healthy`, `degraded`, `failed`

### Status rollup rule

A project can have multiple environments, each with multiple services. The card shows **worst-status-wins**: if any service in any environment is `degraded` or `failed`, that's what the card shows, regardless of how many other services are healthy. `deploying` shows only if something is actively mid-deploy and nothing worse is happening elsewhere in the project. This mirrors how most orchestration dashboards roll up aggregate health, and it's the safer default — the card should alarm on the worst case, not average it away.

### Creating a project

Form fields:

- Project name
- Description
- **Environments — multi-select** (`staging`, `production`, `preview`). A project can be created with more than one environment at once; each environment likely gets its own server/service mapping downstream (server/service wiring itself isn't part of the creation form — that's a follow-up step once the project exists).

---

## 4. Settings page

### SSH keys

- Add a key by name.
- Either generate one (`ssh-keygen -t ed25519`) or paste an existing one, then save.
- A public key is shown that the user installs on their host (appended to `authorized_keys` on the target server) so Warden can connect.

### Remote servers

List view — each server as a card:

- Server name
- CPU / memory / disk usage
- Server type (returned on connect, if available)
- Location/region (e.g. `eu-central`, `eu-west`)
- Connected duration
- Status: `connected`, `idle`, `offline`
- Container count

Clicking a server opens its detail view:

**Resources tab**

- Time filter: **Phase 1 ships with 24h only.** 7d/30d/all-time are deferred — the collection pipeline (a recurring polling job + storage) needs to be proven with one window before adding retention tiers for longer ones. Building multiple time ranges before the underlying collection even works is solving a problem we don't have yet.
- CPU: current %, peak, load average, avg — plus a graph
- Memory: current usage / total, peak, avg — plus a graph
- Disk: current usage / total, peak, avg — plus a graph
- Docker disk breakdown: total used vs. total available, shown as a pie chart — images / volumes / build cache / containers, plus how much is prunable

**Containers tab**

- List of containers on that server (e.g. `argus-api`, `argus-web`, `argus-postgres`, `argus-redis`, `traefik`)
- State per container (`starting`, `draining`, `running`)
- CPU/memory per container

**Traefik dynamic config**

- View and configure Traefik's routing config for that server.
- ⚠️ **Open decision, not resolved for Phase 1**: direct free-text config editing risks breaking live routing on a bad edit. Needs either a "validate before apply" step or a structured form limited to safe fields, before this ships for real. Flagging now so the UI isn't built around an unreviewed assumption.

**Run cleanup**

- Button opens a modal showing dangling images, build cache, stopped containers, unused networks — each with space used, plus a total reclaimable figure. User confirms to actually delete.

**Test connection**

- Button opens a modal showing live connection diagnostics, e.g.:
  ```
  Testing fra-01 65.108.44.17:22
  TCP reachability 65.108.44.17:22
  SSH handshake ed25519 · nimbus-deploy
  Ping 24ms avg · 0% loss
  Docker daemon v27.1 · 12 containers
  ```

**Danger zone**

- Delete the server.

### Team & roles

- Invite by name + email.
- Roles: `viewer` (default), `developer`, `deployer`, `devops`, `admin`. `admin` manages the team, servers, SSH keys, org settings and can delete the organisation.
- ⚠️ **Open decision, not resolved for Phase 1**: the exact permission boundary between `deployer` and `devops` isn't defined yet (e.g. does `devops` get SSH key/server management that `deployer` doesn't?). Needs deciding before this maps onto real auth guards.

### API tokens

- Create by: token name, scope (`read-only: status, logs`; `deploy: trigger deploys, rollback`; `admin: full API access`), and expiry (`30 days`, `90 days`, `1 year`, `no expiry`).
- Table of existing tokens: name, token, scope, last used, expires.

### Argus integration

- **Deferred — not part of Phase 1.** Design not yet settled.

---

## Explicitly out of scope for Phase 1

- Actually triggering a deploy, build, or container swap
- Health-check-gated rollback logic
- Traefik config editing being production-safe (UI may exist, safety mechanism doesn't yet — see open decision above)
- Metrics history beyond 24h
- Argus integration

## Open decisions (unresolved, tracked here so they aren't silently assumed)

- [ ] Traefik dynamic config: raw editor with validation, or structured safe-fields form?
- [ ] Exact permission split between `deployer` and `devops` roles
- [ ] Whether GitHub/Google OAuth users can also set an optional password as a fallback login method
