---
title: Backups
description: Daily encrypted backups to S3 or R2, retention, download and restore.
sidebar:
  order: 2
---

Warden backs up each database every day: the dump streams from your server, is encrypted with your organization's key (AES-256-GCM), and goes to S3-compatible storage. It's never held whole on disk or in memory.

## Schedule and retention

On a database's **Backups** tab, **Schedule**:

- **Daily backups**: on or off.
- **Time of day**: shown in your local time (stored in UTC). Default 02:00 UTC.
- **Keep for (days)**: 1 to 365. Default 7.

Older backups are deleted after each new one succeeds. **The newest finished backup is always kept**, however old. **Back up now** runs one straight away. If a backup fails, Warden sends a **Backup failed** [notification](/notifications/), once, not on every retry.

## Where backups go

**Settings → Backup storage** decides:

- **Your own bucket**: any S3-compatible store, such as Cloudflare R2, AWS S3 or Backblaze B2. Enter the endpoint (https), bucket, access key ID and secret. **Test and save** writes and deletes a small file first, so a wrong key is caught before any backup runs. DevOps and Admin can change it.
- **Warden storage**: the bucket the Warden installation provides, if it has one.

Your own bucket takes priority. Each backup remembers where it went.

## Download

**Download** streams the backup to you, decrypted. It's a standard file: a `.dump` for Postgres (restore it with `pg_restore`), a gzipped SQL dump (`.sql.gz`) for MySQL, a gzipped RDB file (`.rdb.gz`) for Redis.

## Restore

**Restore** replaces all of the database's current data with the backup. Anything written since the backup is lost, so you type the database's name to confirm.

The backup is decrypted to a temporary file and checked before it touches the database: a damaged or tampered file is refused and your data is left as it was. The restore appears as a step-by-step log like a deploy.
