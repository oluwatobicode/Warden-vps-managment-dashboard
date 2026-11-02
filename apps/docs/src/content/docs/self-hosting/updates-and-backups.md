---
title: Updates and backups
description: Update Warden to a new version, back up its own database every night, and restore it.
sidebar:
  order: 3
---

## Updating

New versions are published whenever the Warden repository's `main` branch changes. To update:

```bash
cd ~/warden/infra/production
./update.sh
```

It pulls the newest images, runs database migrations, and restarts the API and worker: about 10 to 20 seconds of downtime. Signed-in users stay signed in. Old Warden images are removed afterwards; nothing else is.

To stay on a version, set `WARDEN_VERSION` in `.env` to a commit's SHA (the images are tagged with it), then run `./update.sh`.

## Backing up Warden's own database

Your apps' databases have their own backups (see [Backups](/databases/backups/)). This is the backup of **Warden's** database: your projects, servers, settings and encrypted secrets.

`backup.sh` dumps the database, compresses it, encrypts it with `MASTER_KEY` (AES-256-GCM) and uploads it to your [backup storage](/self-hosting/configuration/#backup-storage) under `warden-self/`. The dump streams straight through: it never sits whole on the disk or in memory.

Run it once to check it works; it prints the backup's name:

```bash
./backup.sh
```

Then run it every night at 03:00:

```bash
(crontab -l 2>/dev/null; echo "0 3 * * * $HOME/warden/infra/production/backup.sh >> $HOME/warden/infra/production/backup.log 2>&1") | crontab -
```

Old backups aren't deleted by Warden. Add a lifecycle rule on the bucket instead, for example "delete objects under `warden-self/` after 30 days".

## Restoring

```bash
./restore.sh <backup name>
```

The name is what `backup.sh` printed, also in `backup.log`. Restoring **replaces Warden's whole database** and asks you to type `restore` first. The backup is decrypted to a temporary file and checked before anything touches the database, so a damaged or tampered file is refused. You need the same `MASTER_KEY` the backup was made with.
