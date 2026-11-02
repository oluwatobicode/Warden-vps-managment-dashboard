---
title: Audit log and Activity
description: Who did what in your organization, and in each project.
sidebar:
  order: 3
---

## Audit log

**Settings → Audit log** (Admin) lists who did what in the organization, newest first. It never records secret values, only which secret was revealed. It records:

- **Secrets**: variables revealed and imported, connection strings and webhook URLs revealed, backups downloaded.
- **Team**: invitations, role changes, removals, API tokens created and revoked.
- **Infrastructure**: servers added and removed, cleanups, proxy setup and config changes, SSH keys, GitHub connected and disconnected, backup storage changes.
- **Projects**: projects and environments created and deleted, deploys triggered, rolled back and cancelled, build settings changed, services stopped, started and deleted, databases created, restarted, restored and deleted.
- **Data**: every query and command run from a database's Data tab, and every row edited there.

## Project Activity

A project's **Activity** (every role) shows the same kind of record for that project only, for example "Tobi revealed DATABASE_URL". It never shows secret values, and it doesn't include the text of database queries (only the Admin audit log does, since a query can contain values).
