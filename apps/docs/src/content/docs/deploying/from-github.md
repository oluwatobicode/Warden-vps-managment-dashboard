---
title: Deploy from GitHub
description: Add apps from a GitHub repository, including monorepos, and how Warden detects what to build.
sidebar:
  order: 1
---

In a project, choose **Add service → From GitHub**. Warden reads the repository through GitHub's API, without cloning it, and suggests a service for each app it finds.

## Public or private

- **A public repo**: paste its address (for example `github.com/acme/api`) and optionally a branch. No setup needed.
- **A private repo**, or to deploy on every push: connect GitHub first under **Settings → GitHub → Connect GitHub** (DevOps and Admin), and choose which repositories Warden may read. Then pick the repository in the wizard.

Without a GitHub connection, Warden reads public repositories through GitHub's anonymous API, which allows 60 requests an hour. If you hit that, Warden says so; connecting GitHub raises the limit.

## What Warden detects

| Found | Becomes |
|---|---|
| Next.js, Nuxt, SvelteKit, React Router, NestJS, Express, Fastify, Hono, Koa | A server app, port 3000 |
| Astro, Vite, Create React App | A **website** (static files, served by Railpack's web server) |
| A package depending on bullmq, bull, agenda, node-cron, bee-queue or a Temporal worker, or named "worker" | A **worker** (no port, no traffic) |
| A Dockerfile | Built with it, port 3000 |
| Python, Go, Rust, Ruby, PHP | Built with Railpack, on its usual port (8000, 8080, 8080, 3000, 8080) |
| Only an `index.html` | A static website |

Libraries (packages with no framework, start script or worker role) are skipped.

### Monorepos

Warden reads `pnpm-workspace.yaml` or the `workspaces` field of `package.json` and looks at up to 30 workspace folders, `apps/` first. Each app becomes its own service, built from the repository root so shared packages build too (for example `pnpm turbo run build --filter=<app>...`).

## Review and create

For each app you picked, check:

- **Service name**, **Server** and **Port**.
- **Dockerfile**, **Build command** and **Start command**, or for a website the **Built site folder** (for example `dist`).
- **Root directory**, for an app in a subfolder.
- **Health check path**: `/` for apps, `/health` for websites.
- **Deploy on pushes that change**: watch paths, one per line, so a push only deploys the apps it touched.
- **Variables**: for websites, set them now; they're baked in when the site is built. Tip: paste a whole `.env` into a **Key** box and it fills in every row.

**Create and deploy** creates every service and starts its first deploy. **Just create** saves them without deploying. All of the build settings can be changed later; see [Build settings](/deploying/build-settings/).
