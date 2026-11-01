#!/usr/bin/env bash
# Restores Warden's own database from a backup.sh backup:  ./restore.sh <name>
# REPLACES everything in Warden's database. Needs the MASTER_KEY it was made with.
set -euo pipefail
cd "$(dirname "$0")"
name="${1:?Usage: ./restore.sh <backup name, e.g. 2026-11-01T03-00-00-000Z>}"
DOCKER="docker"; docker info >/dev/null 2>&1 || DOCKER="sudo docker"
read -r -p "This replaces Warden's whole database with the backup $name. Type restore to go on: " ok
[ "$ok" = restore ] || { echo "Stopped."; exit 1; }
tmp=$(mktemp); trap 'rm -f "$tmp"' EXIT
# Decrypt to a file first: a tampered file only fails at its very end, and must never reach the database.
$DOCKER compose run --rm -T --no-deps worker node apps/worker/dist/cli/self-backup.js restore "$name" > "$tmp"
$DOCKER compose stop api worker
$DOCKER compose exec -T postgres psql -U warden -d postgres -c "DROP DATABASE warden WITH (FORCE)" -c "CREATE DATABASE warden OWNER warden"
gunzip -c "$tmp" | $DOCKER compose exec -T postgres psql -U warden -d warden -v ON_ERROR_STOP=1 -q
$DOCKER compose up -d
echo "Restored $name."
