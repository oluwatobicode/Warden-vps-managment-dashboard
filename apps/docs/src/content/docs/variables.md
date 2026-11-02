---
title: Variables and secrets
description: Environment and service variables, secrets, importing a .env file, and when changes take effect.
---

Variables become environment variables in your app's container.

## Environment and service variables

- **Environment variables** (the project's **Variables** page) are shared by every service in that environment.
- **Service variables** (a service's **Variables** tab) belong to one service. A service variable with the same key **overrides** the environment's.

A service's **What the container gets** view shows the final result, with each value tagged **this service** or **environment**.

Databases add their connection string as an environment variable automatically, for example `DATABASE_URL`. See [Databases](/databases/create-and-connect/).

## Adding a variable

- **Key**: `UPPER_SNAKE_CASE`, up to 128 characters.
- **Value**: up to 16,000 characters.
- **Secret**: on by default. A secret is hidden in lists and only shown when someone with access presses **Reveal**. Every value is stored encrypted, secret or not.

Developers and up can add, edit and reveal variables. Every reveal is recorded in the audit log and the project's Activity, by name, never with the value.

## Import a .env file

**Import .env** takes a pasted `.env` or an uploaded file, up to 200 variables. Each line shows whether it's **New** or already **Exists** (replace or skip it), and repeated keys use the later line. **Save all as secrets** marks every one secret. Everything is saved together, or nothing is.

## When changes take effect

On each service's **next deploy**. A running version keeps the variables it started with. Variables aren't versioned, so a [rollback](/deploying/manage/#roll-back) starts the old version with today's variables.

:::caution[Website variables are baked in]
A static website (Vite, Astro…) reads its variables when it's **built**, not when it runs. Change one, then deploy again to rebuild it.
:::
