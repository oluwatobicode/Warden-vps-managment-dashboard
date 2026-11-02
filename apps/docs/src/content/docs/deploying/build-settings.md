---
title: Build and start settings
description: Dockerfile or Railpack, build and start commands, release commands, health checks, watch paths and deploy on push.
sidebar:
  order: 3
---

A service's **Settings → Build & start** controls how Warden turns the repository into a running app. Changes apply from the next deploy.

## Dockerfile or Railpack

If the **Dockerfile path** exists (from the **Root directory**), Warden builds with it. Otherwise [Railpack](https://railpack.com) works out how to build the app, and the **Build command** and **Start command** override what it picks. Each command is one line; join several with `&&`.

## Websites

For a static site (Vite, Astro, plain HTML), set **Built site folder** to the folder the build produces, for example `dist` (or `.` for files at the repository root). Railpack serves it with its own web server.

Leave **Start command** empty for a website: a start command switches static serving off.

## Release command

Runs once in the new version before it goes live, for example `npx prisma migrate deploy`. If it fails, the deploy stops and the old version keeps serving. It has 10 minutes.

:::tip
Old code keeps running against the new database for a few seconds during the swap, and a rollback doesn't undo migrations. Keep migrations backwards-compatible: add columns before using them, remove them a release later.
:::

## Port and health check

The **Port** (under **General**) is the port your app listens on. Listen on `0.0.0.0`, not `localhost`, or Warden can't reach it; the port is also passed in `$PORT`.

Before a new version gets traffic, Warden requests its **Health check path** on that port, for up to 90 seconds:

- On the default `/`, any answer below 500 passes, since many APIs answer 404 there.
- On any other path, the answer must be 2xx or 3xx.
- A **worker** has no health check: it must still be running 10 seconds after starting.

## Watch paths

**Watch paths**, one per line (up to 20): a push only deploys this service if it changed files under one of them. Empty means any change deploys. Useful in monorepos.

## Deploy on every push

**Deploy on every push** deploys when the service's branch gets a push. It needs the repository connected through the Warden GitHub App (**Settings → GitHub**).

If you deploy from CI with an [API token](/api-tokens/) instead, turn this off, or each push deploys twice.
