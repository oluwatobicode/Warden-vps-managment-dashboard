# infra: local development services

`docker compose up -d` from this folder starts:

| Service | What | Address |
|---|---|---|
| `postgres` | Warden's own database | `localhost:5433` (user/pass/db `warden`) |
| `redis` | Warden's sessions + BullMQ | `localhost:6380` |
| `ssh-target` | A pretend VPS: an SSH server with the `docker` CLI | `127.0.0.1:2222`, user `warden`, key-only (`ssh-target/authorized_keys`) |
| `docker-target` | The pretend VPS's **own** Docker engine (Docker-in-Docker) | only reachable from `ssh-target` |
| `s3-local` | An S3-compatible store (Adobe S3Mock) for testing database backups | `http://localhost:9090`, bucket `warden-backups`, any keys |

## Why the pretend VPS has its own Docker

Databases Warden creates on `ssh-target` run inside `docker-target`, sealed off from this Mac's Docker. If `ssh-target` used the Mac's Docker socket instead, Warden would see (and Run cleanup would prune) containers from your other projects.

## One-time setup after `ssh-target` is (re)created

The `docker` CLI is installed on first start (about a minute, watch `docker logs infra-ssh-target-1`). Then point it at `docker-target`:

```bash
docker exec -u warden -e HOME=/config infra-ssh-target-1 sh -c \
  'docker context create warden-target --docker host=tcp://docker-target:2375; docker context use warden-target'
```

Check: `ssh -p 2222 warden@127.0.0.1 docker ps` should work and list only Warden's test containers.

## Backups against s3-local

In `apps/api/.env` and `apps/worker/.env`:

```
BACKUP_S3_ENDPOINT=http://localhost:9090
BACKUP_S3_BUCKET=warden-backups
BACKUP_S3_ACCESS_KEY_ID=local
BACKUP_S3_SECRET_ACCESS_KEY=local
```

For Cloudflare R2, swap in `https://<account-id>.r2.cloudflarestorage.com` and an R2 API token scoped to the bucket.
