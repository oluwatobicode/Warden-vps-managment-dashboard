---
title: Create and connect
description: Postgres, MySQL and Redis on your server, on a private network, with their connection string as a variable.
sidebar:
  order: 1
---

Warden runs databases as containers on your server, with their data in a Docker volume that survives restarts and upgrades of the container.

## Engines

| Engine | Versions (first is the default) | Notes |
|---|---|---|
| PostgreSQL | 18, 17, 16 | The usual choice |
| MySQL | 9.7, 8.4 | Needs about 400 MB of memory |
| Redis | 8.10, 8.8, 8.6 | Caches and queues, saved to disk |

## Create a database

**Add service → Database**: pick the **Engine**, a **Name**, the **Version** and the **Server**, and name the **Connection string variable** (default `DATABASE_URL`, or `REDIS_URL` for Redis). Warden generates a strong password, stores it encrypted, and shows each step of creating the database live.

## Connecting your apps

The connection string is saved as a **secret environment variable** in the database's environment, so every service there gets it on its next deploy.

:::caution[Same server only]
A database is only reachable on a private network on its own server. It never has a public port. Apps that use it must run on the **same server**.
:::

If a service has its own variable with the same name (copied from a laptop's `.env`, for example), it overrides the one Warden made, and the app tries to connect to the wrong place. Remove the service's copy.

Inside the private network the database's host is its container's name, not `localhost`: inside a container, `localhost` is the container itself.

## Overview

A database's **Overview** shows its engine, host, port, database name and user. **Reveal** shows the connection string (recorded in the audit log), and **Restart** restarts it. Creating, restarting and restoring each show up as a step-by-step log.

## Delete a database

**Danger zone → Delete database** removes the container and its connection variable. Its backups are deleted too.

**The data is kept by default**: the volume stays on the server. To delete the data as well, turn on **Also delete all its data** and type the database's name. That can't be undone.
