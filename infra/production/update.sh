#!/usr/bin/env bash
# Updates Warden to the newest images (or the WARDEN_VERSION in .env).
# Migrations run first; the api and worker restart after them. ~10-20 s of downtime.
set -euo pipefail
cd "$(dirname "$0")"
DOCKER="docker"; docker info >/dev/null 2>&1 || DOCKER="sudo docker"
git pull --ff-only || echo "(couldn't update the checkout; using the compose file as it is)"
$DOCKER compose pull -q
$DOCKER compose up -d --remove-orphans
# Old Warden images only (never other images or any volume).
$DOCKER image prune -f --filter label=org.opencontainers.image.source=https://github.com/oluwatobicode/Warden-vps-managment-dashboard >/dev/null
$DOCKER compose ps
