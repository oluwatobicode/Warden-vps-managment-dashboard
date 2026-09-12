# @warden/frontend

Vite + React dashboard for Warden. See the root README for how this fits into the monorepo.

## Why Vite (not Next.js)

Warden's frontend is a logged-in dashboard, not a public/SEO-facing site — Next's core value (SSR/SSG for SEO, ISR) doesn't apply here. Vite gives a straightforward SPA without the app-router/server-components complexity, which matters for a heavily interactive UI (the Railway-style draggable canvas view).

## Tabs

- **Home** — overview cards: Projects, Services, Deploys, connected Servers
- **Projects** — project cards → project settings + "add services"; Railway-style canvas view of servers/databases as draggable icons
- **Settings** — remote servers, SSH keys, team & roles, notifications, API tokens, Argus integration, branding, plan & billing

## Stack

| Concern                  | Choice                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| Build tool               | Vite                                                                                     |
| Language                 | TypeScript                                                                               |
| Styling                  | Tailwind CSS v4 (`@tailwindcss/vite` plugin — no `tailwind.config.js`/PostCSS needed)    |
| Icons                    | Hugeicons                                                                                |
| Routing                  | React Router                                                                             |
| Forms                    | React Hook Form + Zod (via `@hookform/resolvers`)                                        |
| Server state / API calls | TanStack Query (React Query) + Axios                                                     |
| Client state             | Zustand — added only when a piece of state genuinely needs it beyond React Query's cache |
| Realtime                 | Socket.io-client — live deploy log streaming from `api`'s WS gateway                     |
| Testing                  | Vitest (matches Vite, unlike Jest which assumes a different transform pipeline)          |

## Setup

```bash
pnpm install
```

## Running

```bash
pnpm run dev      # Vite dev server, localhost:5173
pnpm run build     # tsc -b && vite build -> dist/
pnpm run preview    # preview the production build locally
```

## Design reference

Reuses the Atlinix design system: dark canvas/sidebar, white content panel, sand-warm neutral text, blue accent. Dokploy used as an additional style reference for the dashboard layout patterns.

## Status

Scaffolded (TypeScript variant, Tailwind v4 confirmed rendering), builds clean via `pnpm turbo run build`. None of the listed libraries beyond Tailwind are installed yet — React Router, RHF, Zod, TanStack Query, Axios, Hugeicons, Socket.io-client, and Zustand (when needed) are next.
