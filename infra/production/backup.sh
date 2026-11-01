#!/usr/bin/env bash
# Backs up Warden's own database to the BACKUP_S3_* bucket, encrypted with
# MASTER_KEY (see apps/worker/src/cli/self-backup.ts). Run nightly from cron.
# Old backups: set a lifecycle rule on the bucket (prefix warden-self/).
set -euo pipefail
cd "$(dirname "$0")"
DOCKER="docker"; docker info >/dev/null 2>&1 || DOCKER="sudo docker"
$DOCKER compose exec -T postgres pg_dump -U warden -d warden --no-owner \
  | gzip \
  | $DOCKER compose run --rm -T --no-deps worker node apps/worker/dist/cli/self-backup.js backup
