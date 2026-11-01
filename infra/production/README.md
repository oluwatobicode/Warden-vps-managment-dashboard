# Running Warden on its own server

Warden runs as five containers on one server: the dashboard (`web`), the `api`, the `worker`, Postgres and Redis. In front of them is `warden-traefik`, the same Traefik that Warden sets up on every server it deploys to. That shared Traefik is why this server can run apps deployed by Warden as well as Warden itself. Nothing is built on the server: GitHub Actions builds the images (`.github/workflows/images.yml`) and the server only pulls them.

## 1. The server (EC2)

- **Instance:** `t4g.small` (ARM, 2 GB). Use `t3.small` if your free plan doesn't cover `t4g`. On a 1 GB size (`t3.micro`), run Warden only and deploy apps to other servers.
- **Image:** Ubuntu Server 24.04 LTS, 64-bit (Arm for `t4g`, x86 for `t3`).
- **Disk:** 30 GB gp3.
- **Security group:**

  | Port | From |
  |---|---|
  | 80, 443 | anywhere |
  | 22 | **your IP only** |
  | 22 | this server's own public IP, only if Warden will also deploy apps to this server (it connects to itself over SSH) |

- **Elastic IP:** allocate one and attach it, so the address survives a stop and start.
- **DNS:** an `A` record for `app.trywarden.xyz` pointing at that IP. If the domain uses Cloudflare, set the record to **DNS only** (grey cloud): Let's Encrypt has to reach the server directly.

## 2. Install

```bash
ssh ubuntu@<elastic ip>
git clone --depth 1 https://github.com/oluwatobicode/Warden-vps-managment-dashboard.git warden
cd warden/infra/production
WARDEN_HOST=app.trywarden.xyz ./install.sh
```

`install.sh` does four things, and running it again is safe:

1. Installs Docker.
2. Adds 2 GB of swap on small instances.
3. Writes `.env` with fresh secrets.
4. Starts `warden-traefik`, then Warden.

**Copy `MASTER_KEY` out of `.env` into a password manager.** Every SSH key and database password Warden stores is encrypted with it.

Then fill in the rest of `.env` and apply it with `sudo docker compose up -d`:

- `RESEND_API_KEY`, for sign-in emails.
- GitHub sign-in.
- The GitHub App.
- `BACKUP_S3_*`.

The first visit to `https://app.trywarden.xyz` gets the certificate, which takes a few seconds.

## 3. Backups of Warden's own database

```bash
(crontab -l 2>/dev/null; echo "0 3 * * * $HOME/warden/infra/production/backup.sh >> $HOME/warden/infra/production/backup.log 2>&1") | crontab -
```

- **What it does:** every night it dumps the database, compresses it, encrypts it with `MASTER_KEY` and uploads it to `BACKUP_S3_BUCKET` under `warden-self/`.
- **Old backups:** add a lifecycle rule on the bucket, e.g. "delete objects under `warden-self/` after 30 days".
- **Restore:** `./restore.sh <name>`. The name is what `backup.sh` printed into `backup.log`. Restoring replaces the whole database.

## 4. Deploying apps to this server too

In Warden, add a server with this server's **public** IP. It needs its own security group entry (step 1), and the SSH user and a key in `~/.ssh/authorized_keys`, like any other server. Then click **Set up proxy**: it recreates `warden-traefik` the same way (sites are unreachable for 2–3 s, Warden's own dashboard included).

Keep heavy builds off a 2 GB server: a build that runs out of memory can take Warden down with it.

## Updating

`./update.sh` pulls the newest images, runs the migrations and restarts. That's 10–20 s of downtime. To pin a version, set `WARDEN_VERSION` in `.env` to a commit's sha.
