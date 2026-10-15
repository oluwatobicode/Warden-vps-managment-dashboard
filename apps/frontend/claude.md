# CLAUDE.md — Warden frontend

Project rules for Claude when working in `apps/frontend` (the Warden dashboard: a self-hosted VPS deploy control plane). The repo-level rules in `/CLAUDE.md` still apply here; this file adds the frontend-specific ones.

## Rules

FIRST THINK AND PLAN AND I WILL APPROVE, ASK QUESTIONS TOO -> NEVER IGNORE THIS

1. **Keep implementation simple.** Prefer the smallest change that solves the problem. No premature abstractions.
2. **API requests use React Query + Axios, in a `hooks/` folder.** All server state goes through `@tanstack/react-query` hooks that call the shared `axiosInstance`. No raw `useEffect` + `axios` in components.
3. **Think before you code.** Read the relevant files, confirm the data shape, and outline the approach before writing.
4. **Do not over-engineer.** No extra layers, wrappers, or config beyond what the task needs.
5. **Think OOP.** Model around clear objects/entities and cohesive responsibilities. Group related logic; avoid scattered free functions when a single owner makes more sense.
6. **Break solutions into `utils/`, `components/`, `hooks/`, `ui/`.** If a piece of logic, view, data-fetch, or presentational primitive can stand on its own, extract it into the matching folder instead of inlining everything in one file.
7. **Use toast notifications for user feedback.** Success, error, and important state changes surface via the toast system — not `alert()`, not silent failures, not ad-hoc inline banners. (Field-level form errors are the exception: they sit under the field.)

## Tech Stack

- **Vite + React + TypeScript** — ESM (the only ESM app in the monorepo)
- **Tailwind CSS v4** via `@tailwindcss/vite` — no `tailwind.config.js`, no PostCSS
- **React Router** — routing and route guards
- **React Hook Form** — all forms
- **@hookform/resolvers** — bridges React Hook Form to Zod schemas
- **Zod** — validation. Reuse the schemas from the `shared-types` package (the same ones the API validates with) instead of writing new ones
- **TanStack Query** — server state, all API data (per rule #2)
- **Axios** — HTTP client, via the shared `axiosInstance`
- **react-hot-toast** — all user feedback (per rule #7)
- **Hugeicons** — icons
- **Zustand** — only when a piece of client state genuinely needs to be global and isn't server data. Not by default.
- **Socket.io-client** — Phase 2 only, for live deploy logs
- **Vitest** — tests (matches Vite's transform pipeline; Jest doesn't)

**Package manager: pnpm only.** Never `npm` or `yarn` in this monorepo — npm can't read pnpm's `node_modules/.pnpm` layout and breaks. Add packages with `pnpm add <pkg>` from `apps/frontend`, or `pnpm --filter frontend add <pkg>` from the root.

Installed 2026-10-14: `@tanstack/react-query`, `react-router` (v8), `react-hook-form`, `@hookform/resolvers`, `zod` (pinned to the same major as shared-types, so the resolver accepts its schemas), `@hugeicons/react` + `@hugeicons/core-free-icons`, `vitest`, and `"shared-types": "workspace:*"`. Not yet: Zustand, Socket.io-client (add when needed).

## Product shape

**One dashboard**, scoped to one organization (Phase 1 is one org per user). Three top-level pages once logged in: **Home**, **Projects**, **Settings** (see `docs/PHASE-1-CORE-FLOW.md`).

There is no tenant switcher and no `TenantContext`: the organization comes from the session (`GET /auth/me`). Never let a page pick an `organizationId` itself — the API resolves the org from the session cookie and ignores any org id the frontend might send.

## Project Structure

```
src/
├── api/
│   └── axiosinstance.ts       # baseURL + withCredentials, envelope unwrapping, 401 → refresh once
├── components/                # shared/dumb UI only — no data-fetching, no feature logic
│   ├── ui/                    # Button, Input, Modal, Badge, StatusPill, Table, CopyField…
│   └── layout/                # AppLayout (sidebar + top bar), page shells
├── contexts/
│   └── AuthContext.tsx        # current user, org, role — from GET /auth/me
├── features/                  # one folder per area, self-contained
│   ├── auth/                  # login, magic link, verify, onboarding, forgot/reset password, invite accept
│   ├── home/                  # metric cards + recent deployments (needs the 1I dashboard endpoints)
│   ├── projects/              # project cards, create project, project detail
│   ├── environments/
│   ├── services/              # service CRUD, assign to server
│   ├── variables/             # environment + service variables, reveal, resolved view
│   ├── servers/               # server CRUD, test connection modal
│   ├── ssh-keys/
│   ├── team/                  # members, invitations, roles
│   ├── api-tokens/
│   ├── notifications/         # channels, send test
│   └── audit-logs/
│   └── <feature>/
│       ├── components/
│       ├── hooks/             # useXxx() wrapping useQuery/useMutation for this feature
│       └── types.ts           # only types that aren't already in shared-types
├── pages/                     # route-level screens that compose feature components
├── routes/
│   ├── app.routes.tsx         # the route tree
│   └── guards.tsx             # RequireAuth, RequireRole
├── types/                     # cross-feature frontend-only types
└── utils/                     # formatDate, apiMessage, role helpers…
```

## Roles

Four org roles on `Membership` (decided 2026-10-02 — see `/CLAUDE.md`). The line between each pair is "can this break something that isn't yours":

| | `VIEWER` | `DEVELOPER` | `DEV_OPS` | `ADMIN` |
|---|---|---|---|---|
| View everything | yes | yes | yes | yes |
| Services and variables (add/edit, reveal secrets); deploy; rollback | | yes | yes | yes |
| Projects and environments (create/delete); servers, SSH keys | | | yes | yes |
| Team, invitations, roles, API tokens, notification channels, audit log | | | | ADMIN |

Frontend rules for roles:

- **The API is the real gate.** The frontend hides or disables what a role can't do so the UI doesn't offer dead buttons — it never *grants* anything. A 403 from the API is always possible and must be handled (toast, no crash).
- Read the role from `AuthContext`, never from the JWT (the JWT deliberately has no role; demotion is instant on the server).
- Use one helper (e.g. `utils/roles.ts`, rank `VIEWER < DEVELOPER < DEV_OPS < ADMIN`) rather than scattering role string comparisons through components.
- `PlatformRole.OWNER` (platform stats) is unrelated to org roles and has no UI in Phase 1.

## Talking to the API

- **Base URL** comes from a Vite env var (e.g. `VITE_API_URL`). Not `import.meta.env.BASE_URL` — that's Vite's public path (`/`), not the API.
- **Auth is cookies only.** `warden_access` (15 min) and `warden_refresh` (7 days, path `/auth/refresh`) are `httpOnly`: JavaScript can't read them and must never try. No `Authorization` header, no token in `localStorage`. `withCredentials: true` on the axios instance is what sends them.
- **On 401:** call `POST /auth/refresh` **once**, retry the original request, and if that fails too, clear the React Query cache, go to `/login`, and toast. Never loop.
- **Response envelope.** Success: `{ success: true, statusCode, message, data, timestamp }` — hooks return `data`. Error: `{ success: false, statusCode, errorCode, message, issues? }`. `issues` is `{ field: [messages] }` on a 400 — map it onto React Hook Form fields with `setError`; show `message` as a toast for everything else.
- **Flat endpoints**, parent in the body or query: `GET /services?environmentId=…`, `POST /services { environmentId, … }`. No nested URLs.
- **Paged lists** (audit log) use a cursor: `?limit=&cursor=`, response `{ items, nextCursor }`. The audit log page shows Newer/Older pages: `useQuery` keyed by `(cursor, limit)` with `keepPreviousData`, and the page keeps a stack of the cursors it has visited. There's no total count, so no "page X of Y" or jumping to a page number (that would need an API change).
- The full endpoint list lives in the api controllers; ask Claude for the current table rather than trusting a copy here.

## Security Expectations (frontend side)

- **Secrets are masked by default** and fetched only on an explicit click: variable values (`/…/reveal`), webhook URLs (`/notification-channels/:id/reveal`). Every reveal is audit-logged server-side. Don't prefetch reveal endpoints, don't keep revealed values in the React Query cache longer than the view needs, and don't log them.
- **Shown-once values** (a new API token): display in a modal with a copy button and a clear "you won't see this again" note. Never put them in a toast, the URL, or `localStorage`.
- No sensitive data in URLs, `console.log`, error toasts, or bundled code. SSH private keys are pasted into a form and sent once; they never come back.
- Zod validation on every form — mirrors server-side validation, never replaces it.
- User-provided text (names, commit messages, error output) is rendered as text, never with `dangerouslySetInnerHTML`.
- Handle 401/403 cleanly — no silent failures.

## Conventions

- **HTTP client:** `src/api/axiosinstance.ts`. All requests go through this instance.
- **Hooks location:** co-located per feature, in that feature's `hooks/` folder — one file per resource (e.g. `features/servers/hooks/useServers.ts`). No global `src/hooks/` for feature hooks.
- **Hook shape:** export a `useXxx()` that wraps `useQuery` / `useMutation` and returns the React Query result directly. Mutations invalidate the queries they affect (creating a service invalidates the services list *and* the project, because the project's `serviceCount` and `status` change).
- **Query keys:** one small key factory per feature (e.g. `serverKeys.all`, `serverKeys.detail(id)`) so invalidation is consistent.
- **Types:** import request/response types from `shared-types` (`Project`, `Server`, `CreateServerInput`…). Only write a local type when shared-types doesn't have it.
- **Components:** consume hooks, render UI. No data-fetching logic inside components.
- **Statuses:** one `StatusPill` in `components/ui` maps every status the API returns (service/project `NOT_DEPLOYED | DEPLOYING | HEALTHY | DEGRADED | FAILED`, server `CONNECTED | IDLE | OFFLINE`) to one colour and label, so the same status never looks different on two pages.

## Scope Boundary

**Phase 1 frontend** covers what the api already serves: auth (email, magic link, GitHub, onboarding, forgot/reset password, invites), projects / environments / services / variables, servers + test connection, SSH keys, team, API tokens, notification channels, audit log.

**Needs an endpoint that doesn't exist yet** — build only after the api side lands:

- Home metric cards + recent deployments (1I dashboard)
- Databases as a service: Postgres, MySQL, Redis (Phase 1, decided 2026-10-15; needs the worker job + api first)
- Canvas view (decided 2026-10-15: shared layout saved on `Service`; needs the save endpoint first)

**Built 2026-10-15 (account):** `/account` page (profile name + DiceBear avatar picker with all 30 styles × 5 faces, password change / add-with-code, sign out of other devices); `UserAvatar` in the console header and project navbar. Hooks in `features/account/hooks/useAccount.ts`; avatar drawing in `features/account/avatar.ts` (one lazily loaded chunk per style).

**Built 2026-10-15 (1G monitoring):** server cards show CPU/MEM/DISK and container counts; the server page has Resources (24h charts in plain SVG, no chart library; Docker disk donut) and Containers tabs, and a Run cleanup modal (live preview, then follows the worker job). Hooks in `features/servers/hooks/useMonitoring.ts`; data refreshes every 60s to match the worker's poll.

**Not Phase 1** — don't add buttons, routes, or empty states for these without an explicit go-ahead:

- Triggering a deploy, build, rollback, live deploy logs (Phase 2)
- Google sign-in (parked)
- Traefik config editor: decided (raw editor AND form, each with a warning, plus validate-before-save and revert), but built after Phase 2 deploys install Traefik
- Metrics history beyond 24h
- Argus integration, billing, branding

If a task looks like it needs one of these, stop and ask before scaffolding it.

## API address: dev vs production (decided 2026-10-15)

- **Dev:** the api has CORS enabled for `CORS_ORIGIN` with credentials; `VITE_API_URL=http://localhost:3000`. `localhost:5173` and `localhost:3000` are the same *site*, so `SameSite=Lax` cookies work.
- **Production:** one origin through Traefik — the dashboard at `/`, the api at `/api` — so `VITE_API_URL=/api`, cookies `SameSite=Lax; Secure`, no CORS. See "Decisions made 2026-10-15" in `/CLAUDE.md`.

## UI scale (2026-10-15)

Components use the design's pixel sizes; `:root { zoom: var(--ui-scale) }` in `index.css` scales the whole UI (1.125, or 1.25 on screens 1600px+). Change the size there, not per component. Because zoom also scales `100dvh`, **never use `h-dvh` / `min-h-dvh`**: use `h-screen-ui` / `min-h-screen-ui` (they divide by the scale). Page side padding is `var(--page-x)`.

## Logging out / session end

Always go through `forgetSession(queryClient)` in `api/queryClient.ts`: it sets `["auth","me"]` to null on the existing query, then removes everything else. Never `queryClient.clear()`: it deletes the query the auth context is subscribed to and leaves the old user on screen.

## `shared-types` in Vite (changed 2026-10-15)

Vite reads `shared-types` from its **TypeScript source**: `resolve.alias` in `vite.config.ts` points `"shared-types"` at `packages/shared-types/src/index.ts`, and `tsconfig.app.json` has the matching `paths` entry so the editor's types come from the same files. A schema or message change shows up on save — no `pnpm --filter shared-types build`, no `vite --force`. (Verified: editing a message in `field.ts` showed in the browser after a reload, with no rebuild.)

This doesn't break the repo's "consume the build" rule: that rule is for Node (api, worker), which can't run `.ts`. Vite compiles TS itself. The api and worker still need `pnpm --filter shared-types build` after a schema change.

Side effect: zod is now bundled from its ES module build, so the production bundle dropped from 1,215 kB to 814 kB (gzip 310 → 241 kB).

History: before this, the frontend used the CommonJS build via `optimizeDeps: { include: ["shared-types"] }`, and Vite's cache meant schema changes needed a `--force` restart.
