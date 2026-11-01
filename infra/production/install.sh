#!/usr/bin/env bash
# Installs Warden on this server (Ubuntu or Debian; tested on an EC2 instance).
# Run from a checkout of the repo:
#   git clone --depth 1 https://github.com/oluwatobicode/Warden-vps-managment-dashboard.git warden
#   cd warden/infra/production && WARDEN_HOST=app.trywarden.xyz ./install.sh
# Safe to run again: it keeps an existing .env and an existing Traefik.
set -euo pipefail
cd "$(dirname "$0")"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# 1. Docker.
if ! command -v docker >/dev/null 2>&1; then
  say "Installing Docker"
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi
DOCKER="docker"
docker info >/dev/null 2>&1 || DOCKER="sudo docker"

# 2. Swap, on small instances: Postgres, the api and the worker share 1-2 GB.
mem_kb=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
if [ "$mem_kb" -lt 3000000 ] && ! swapon --show | grep -q .; then
  say "Adding a 2 GB swap file (this server has $((mem_kb / 1024)) MB of memory)"
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile >/dev/null && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

# 3. Settings, with fresh secrets the first time.
if [ ! -f .env ]; then
  : "${WARDEN_HOST:?Run it as WARDEN_HOST=app.your-domain ./install.sh}"
  say "Writing .env for $WARDEN_HOST"
  cp .env.example .env
  chmod 600 .env
  set_var() { sed -i "s|^$1=.*|$1=$2|" .env; }
  set_var WARDEN_HOST "$WARDEN_HOST"
  set_var POSTGRES_PASSWORD "$(openssl rand -hex 24)"
  set_var MASTER_KEY "$(openssl rand -hex 32)"
  set_var JWT_ACCESS_SECRET "$(openssl rand -hex 32)"
  set_var JWT_REFRESH_SECRET "$(openssl rand -hex 32)"
  NEW_ENV=1
fi
set -a; . ./.env; set +a

# 4. Warden's Traefik: the same one "Set up proxy" makes on every server, printed by the worker's own code.
say "Starting Traefik (ports 80 and 443)"
$DOCKER pull -q "ghcr.io/oluwatobicode/warden:${WARDEN_VERSION:-latest}" >/dev/null
SH="sh"; [ "$DOCKER" = docker ] || SH="sudo sh"
$DOCKER run --rm "ghcr.io/oluwatobicode/warden:${WARDEN_VERSION:-latest}" node apps/worker/dist/cli/proxy-script.js | $SH

# 5. Warden.
say "Starting Warden"
$DOCKER compose pull -q
$DOCKER compose up -d

say "Done. Warden is starting at https://$WARDEN_HOST"
cat <<NEXT
  - DNS: an A record for $WARDEN_HOST pointing at this server's public IP.
    HTTPS needs it: the certificate is issued on the first visit once DNS points here.
  - Open ports 80 and 443 to everyone (EC2: the security group). Keep 22 for your own IP.
  - Nightly backups of Warden's own database: fill in BACKUP_S3_* in .env, then
      (crontab -l 2>/dev/null; echo "0 3 * * * $(pwd)/backup.sh >> $(pwd)/backup.log 2>&1") | crontab -
  - Later updates: ./update.sh
NEXT
if [ "${NEW_ENV:-}" = 1 ]; then
  printf '\n\033[1;33mSave a copy of MASTER_KEY from .env somewhere OFF this server (a password manager).\nWithout it, every SSH key and database password Warden stores is unreadable.\033[0m\n'
fi
