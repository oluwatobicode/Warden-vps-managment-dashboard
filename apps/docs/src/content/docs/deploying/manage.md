---
title: Roll back, cancel, stop and delete
description: Going back to an earlier version, stopping a deploy in progress, stopping an app, and removing it.
sidebar:
  order: 5
---

## Roll back

Every successful deploy is a version you can go back to. On the **Deployments** tab, choose **Roll back** on an earlier version that went live.

The current version keeps running until the old one passes its health check, like any deploy. Warden reuses the old version's image if it's still on the server (it keeps the last 3); otherwise it rebuilds that commit.

:::caution[Not rolled back]
- **The database**: migrations stay applied. To go back, [restore a backup](/databases/backups/).
- **Variables**: the old version starts with today's variables.
:::

## Cancel a deploy

**Cancel** on a deploy's page. A queued deploy is cancelled at once. A running one stops after the step it's on (a build in progress finishes first). The live version isn't changed either way.

## Stop and start

**Stop** stops the live version's container; the service shows **Stopped**. **Start** brings the same version back. If a new deploy of a stopped service fails, it stays stopped.

## Delete a service

**Settings → Delete** stops the service on its server and removes it there: its containers, its address and its kept versions. Then it's deleted with its variables, domains and deploy history. Environment variables aren't affected. Type the service's name to confirm.

If the server can't be reached, Warden refuses, so nothing is left running unnoticed. **Delete anyway** deletes it in Warden and shows the command to clean up the server by hand.

Deleting an environment or project does the same for every app inside it. Both are refused while they contain databases, so data is never deleted by accident: delete each database from its own page first.

Databases are deleted from their own page; see [Create and connect](/databases/create-and-connect/#delete-a-database).

## Deploy output

Each deploy's page shows every step with its duration, and the build output live. Output is kept for 30 days.

| Status | Meaning |
|---|---|
| Queued | Waiting for its turn (one build per server at a time) |
| Building, Deploying, Health check | In progress |
| Succeeded | Went live |
| Gate failed | Built and started, but failed its health check, so it never went live |
| Failed | Stopped by an error; the old version keeps serving |
| Cancelled | Stopped by someone; the live version wasn't changed |
