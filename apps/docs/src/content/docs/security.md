---
title: Security
description: How Warden protects your secrets, servers and data.
---

## Secrets are encrypted

Everything secret is encrypted with **AES-256-GCM** before it's saved:

- SSH private keys.
- Variables (secret or not).
- Database passwords.
- Notification webhook URLs.
- Your backup storage's secret key.
- Database backups, with your organization's key, before they're uploaded.

Each organization has its own **data key**. That key is itself encrypted with a **master key** that the Warden installation keeps outside the database, so a copy of the database alone can't decrypt anything.

Passwords are stored as bcrypt hashes. API tokens and sign-in refresh tokens are stored only as hashes.

## What's never shown

- SSH private keys, after you add them: only the public half.
- API tokens, after the moment they're created.
- Secret values, except when someone with access presses **Reveal**, and that's recorded.
- Secret values in logs: they're replaced with `••••••` before a line is saved. See [Logs](/logs/#secrets-are-hidden).

## Sign-in

- Sessions use a 15-minute access cookie and a refresh token that changes on every use; reusing an old refresh token signs out that whole session.
- Cookies are `httpOnly` (scripts can't read them) and `Secure` over HTTPS.
- Removing a member or changing their role takes effect at once.
- Sign-in, sign-up links and password-reset codes are rate-limited.

## Your servers

- Warden connects over SSH with your key; nothing is installed apart from Traefik.
- Apps never publish ports of their own. Only Traefik listens on 80 and 443.
- Databases are on a private network with no public port.
- Clone tokens for private repositories are short-lived and never appear in a command line.
- Traefik's status page is only reachable from inside its own container.

## Roles and tokens

Every request is checked on the server against the member's current role (see [Roles](/team/roles/)). API tokens can only deploy and read deployments (see [API tokens](/api-tokens/)).

## Audit log

Reveals, team changes, infrastructure changes, deploys and database queries are recorded. See [Audit log](/team/audit-log/).
