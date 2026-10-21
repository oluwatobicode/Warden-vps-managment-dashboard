# Databases + backups: the build plan

Item 18 (databases as a service) and 18b (backups to Cloudflare R2). Written 2026-10-21 for Tobi to build, with Claude stepping in when stuck.

> **Status 2026-10-21: built and tested locally by Claude** (Tobi: "just build it"), against the sealed test server + S3Mock. Still to do: test on real Cloudflare R2 and the GCP server. Differences from this plan are listed in CLAUDE.md under "Databases as a service" and "Database backups".

**How to use this doc**

- Work top to bottom. Each stage ends with **Done when**: check every line before moving on.
- After each stage, send Claude the diff for review before the next one. Small reviews catch mistakes before they spread.
- Snippets here show the *shape* of tricky code, not finished code. Write it yourself; that's the point.
- The closest existing code to copy patterns from is **Docker cleanup**: `apps/api/src/modules/monitoring/cleanup.service.ts` (API creates a row + queues a job) and `apps/worker/src/jobs/cleanup.ts` (worker SSHes in, runs commands, writes the result). Databases follow the same flow.

---

## 0. Decisions (already made)

| Topic | Decision |
|---|---|
| Engines and versions | Postgres **18** (default), 17, 16 · MySQL **9.7** (default), 8.4 · Redis **8.10** (default), 8.8, 8.6. Check the exact Docker Hub tags when you write the catalog |
| Connection string | **Auto-created environment variable**, secret. Default name `DATABASE_URL` (Postgres, MySQL) or `REDIS_URL`; the user can change it |
| Network | One private Docker network per environment on each server. **No public port.** Apps that use a database must run on the same server (Phase 1 limit) |
| Delete | Keeps the data volume by default. Deleting data = tick a box + type the name |
| Who | **Developer and up**: full permissions on databases, including deleting data |
| Deploy history | Create and restart each make a **Deployment** row (shows on Home) |
| Phase 1 actions | Create, Restart, Delete, status, connection info |
| Backups | Daily, **keep 7 days** by default, changeable per database. Back up now, list, download, restore |
| Backup storage | **Warden's own R2 bucket by default** (set in `.env`), and each org **may bring its own R2** in Settings, which then wins |
| Backup encryption | **Yes**, with the org's key, before upload |

## 1. New ideas you'll meet (read once)

| Idea | In plain words |
|---|---|
| **Image** | A packaged program, e.g. `postgres:18`. Docker downloads it once per server |
| **Container** | A running copy of an image. Ours are named `warden-db-<id>` |
| **Volume** | A folder Docker manages that survives the container being deleted. **The data lives here**, not in the container |
| **Network** | A private network between containers on one server. Containers on it find each other **by name**, like office phone extensions. Nothing on it is reachable from the internet unless you publish a port (`-p`), which we never do |
| **Environment variables** | How the official images get their settings (user, password, database name) on first start |
| **Health check** | A command Docker runs inside the container every few seconds (`pg_isready`). `docker inspect` then reports `starting`, `healthy` or `unhealthy` |
| **Restart policy** | `--restart unless-stopped`: Docker restarts it after a crash or a server reboot |
| **Job queue** | You already know this from the worker: the API puts a job in a BullMQ queue and returns at once; the worker does the slow part |
| **Streaming** (Part B) | Moving data piece by piece instead of all at once, so a 2 GB dump never has to fit in memory |
| **S3 / R2** (Part B) | Online file storage. R2 is Cloudflare's, and it speaks the same language (API) as Amazon S3, so the AWS S3 library works with it |
| **MinIO** (Part B) | A small S3-compatible server you can run locally in Docker. It lets you build and test backups **without** a real R2 bucket or any cost. When it works, you change four `.env` values and it uses R2 instead |

---

# Part A: Databases

## A0. A test server that has Docker

Your local SSH test container (`ssh-target`, 127.0.0.1:2222) has **no Docker**, so nothing in Part A can run there today. Two ways:

1. **Your GCP server** (once it's back up). Real, and the final test happens there anyway.
2. **Local:** give `ssh-target` the Docker CLI and your Mac's Docker socket, so commands run on Docker Desktop. In `infra/docker-compose.yml`, on `ssh-target`:
   - add `DOCKER_MODS: linuxserver/mods:universal-docker` under `environment` (installs the `docker` command)
   - add `- /var/run/docker.sock:/var/run/docker.sock` under `volumes`
   - restart it and check: `ssh -p 2222 warden@127.0.0.1 docker ps`. If it says *permission denied*, the `warden` user can't read the socket; ask Claude, it's a one-line fix.

**Done when:** Test connection on that server shows the Docker step as passing.

## A1. The catalog (`packages/shared-types/src/database.ts`)

**Goal:** one place that knows everything about each engine, so the API, worker and UI never disagree.

Write:

- `DatabaseEngineSchema = z.enum(["POSTGRES", "MYSQL", "REDIS"])`
- `DATABASE_CATALOG`, one entry per engine:
  - `label`, `versions` (newest first, the first is the default), `port`
  - `defaultVariable` (`DATABASE_URL` / `REDIS_URL`), `idleMemoryMb` (Postgres ~100, MySQL ~400, Redis ~20)
  - **`dataPath(version)`**, a function, not a string. ⚠️ **Postgres 18+ moved its data folder.** For 18 and later, mount the volume at `/var/lib/postgresql`. For 16 and 17, mount at `/var/lib/postgresql/data`. Mounting 18 at the old path makes the container fail to start
  - MySQL: `/var/lib/mysql`. Redis: `/data`
- `CreateDatabaseSchema`: `environmentId`, `serviceName` (reuse `slugName`), `engine`, `version` (must be one of that engine's versions: use `.superRefine`), `serverId`, `variableName` (reuse the variable key rule from `variable.ts`)
- `DatabaseInfoSchema`: what the API returns about a database (engine, version, database name, username, container name, variable name, **never the password**)
- Add `DATABASE` handling to `ServiceSchema` consumers later; the type already exists

**Done when:** `pnpm --filter shared-types build` passes, and an invalid combination (MySQL 18) fails the schema.

## A2. The database model (`packages/db/prisma/schema.prisma`)

**Goal:** store what Warden needs to manage the container.

New model `ServiceDatabase`, one per database service:

| Field | Notes |
|---|---|
| `id`, `serviceId` (`@unique`), `organizationId` | Composite FK to `Service` on `(serviceId, organizationId)`, like every other model. `onDelete: Cascade` |
| `engine` | Enum `DatabaseEngine` (POSTGRES, MYSQL, REDIS) |
| `version` | String, e.g. `"18"` |
| `databaseName`, `username` | Generated: `app` / `app` is fine |
| `passwordEncrypted` | `encrypt(password, dek, 'v1')`, like variables |
| `rootPasswordEncrypted` | MySQL only (nullable): MySQL needs a separate root password |
| `containerName`, `volumeName`, `networkName` | Generated, see A4 |
| `variableName`, `environmentVariableId` | The auto-created variable, so delete can remove it |
| `createdAt`, `updatedAt` | |

Remember the repo rule: **every FK column gets an index.** Migrate with `migrate diff` → `migrate deploy`, as before (see `claude.md`).

**Done when:** the migration applies and `pnpm --filter db build` passes.

## A3. Docker commands (`packages/docker-client/src/database.ts`)

**Goal:** typed wrappers, like `listContainers`. Each takes `run` from an SSH session.

| Function | Command shape |
|---|---|
| `ensureNetwork(run, name)` | `docker network inspect <name>`; if missing → `docker network create <name>` |
| `ensureVolume(run, name)` | `docker volume create <name>` (safe to repeat) |
| `runContainer(run, opts)` | `docker run -d --name … --network … --restart unless-stopped -v <volume>:<dataPath> --env-file <file> --label warden.service=<id> --health-cmd … --health-interval 5s --health-retries 10 --health-start-period 20s <image>` |
| `healthStatus(run, name)` | `docker inspect --format '{{.State.Health.Status}}' <name>` → `starting` / `healthy` / `unhealthy` |
| `restartContainer`, `removeContainer` (`docker rm -f`), `removeVolume` (`docker volume rm`) | |

**Health commands** (run *inside* the container, so they read its own env vars; passwords never appear in the command):

- Postgres: `pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"`
- MySQL: `mysqladmin ping -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" --silent`. ⚠️ Use `127.0.0.1`, not `localhost`: on first boot MySQL runs a temporary server with no network, and `localhost` would report "alive" before it's really ready
- Redis: `REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli ping | grep -q PONG`

**Redis has no password variable**, so start it as `sh -c 'exec redis-server --appendonly yes --requirepass "$REDIS_PASSWORD"'`.

**Env vars per engine** (go in the env file, see A5):

- Postgres: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- MySQL: `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`
- Redis: `REDIS_PASSWORD`

⚠️ **Shell safety.** Every value that goes into a command must be either generated by Warden (names, passwords) or checked against a strict pattern. Passwords: 32 random **letters and digits only** (`crypto.randomBytes` → base62). Names: `[a-z0-9-]` only. Still quote them.

**Done when:** unit tests with a fake `run` (copy the pattern in `docker.test.ts`) check each command string, and that `runContainer` **never** includes `-p` (no published port).

## A4. The API (`apps/api/src/modules/databases/`)

**Goal:** create, restart, delete, reveal. Flat routes, like the rest of the API:

| Route | Who | Does |
|---|---|---|
| `POST /databases` | Developer+ | Create (below), returns 202 + the service |
| `GET /databases/:serviceId` | Everyone | `DatabaseInfo` |
| `POST /databases/:serviceId/restart` | Developer+ | New deployment row + queue a restart job |
| `DELETE /databases/:serviceId` | Developer+ | Body `{ deleteData: boolean, confirmName?: string }`. If `deleteData`, `confirmName` must equal the service name |
| `GET /databases/:serviceId/connection` | Developer+ | Reveal the connection string. **Audit-logged**, like variable reveals |

**Create, step by step** (`database.service.ts`):

1. Check the environment is in the session's org, and the server is in the org **and** is a `DEPLOY` server.
2. Check the variable name isn't already used in that environment (friendly 409 instead of a database error).
3. Generate: password(s), names. Use the first 8 hex characters of ids for short names: container `warden-db-<serviceId8>`, volume `warden-db-<serviceId8>-data`, network `warden-env-<environmentId8>`.
4. Build the connection string (the host is the **container name**):
   - `postgresql://app:<pw>@warden-db-x7k2…:5432/app`
   - `mysql://app:<pw>@…:3306/app`
   - `redis://default:<pw>@…:6379`
5. **One `$transaction`:**
   - create the `Service` (type `DATABASE`, status `DEPLOYING`, `serverId` set)
   - create the `ServiceDatabase` (passwords encrypted)
   - create the `EnvironmentVariable` (connection string encrypted, `isSecret: true`)
   - **increment the deploy counter** and create the `Deployment` (status `QUEUED`). This is the first code that uses the counter:
     ```ts
     const { deployCounter } = await tx.organization.update({
       where: { id: orgId },
       data: { deployCounter: { increment: 1 } },
       select: { deployCounter: true },
     });
     // then create the Deployment with number: deployCounter
     ```
     Why the counter is inside the transaction: two deploys at the same moment must never get the same `#number`. The database increments it atomically.
6. After the transaction: queue the job (`database-provision`), audit `database.created`.
7. If queueing fails: mark the deployment `FAILED` with a message, the same as cleanup does.

**Watch out:**
- `ServiceService.deleteService` refuses services that have a server (`has_server`). Databases always have one, so they're deleted through `DELETE /databases/:id`, never `/services/:id`. Make `/services/:id` say "use the database delete" for type `DATABASE`.
- `PATCH /services/:id/server` must refuse to move a database: its data volume is on that server.
- Add the new audit actions in `shared-types/audit-log.ts` and their sentences in the frontend's `describeAudit.ts`: `database.created`, `database.restarted`, `database.deleted` (metadata `dataDeleted: true/false`), `database.connection_revealed`.

**Done when:** creating returns 202, and the database has the service, its `ServiceDatabase`, the variable and a `QUEUED` deployment. Wrong org → 404, a build server → 400, an existing variable name → 409.

## A5. The worker jobs (`apps/worker/src/jobs/database.ts`)

**Goal:** make it real on the server. New queue `QUEUES.databases`, job payload `DatabaseJobSchema = { action: "provision" | "restart" | "remove", serviceId, organizationId, deploymentId?, deleteData? }`. Validate it on arrival, like the other jobs.

**`provision`, step by step.** Write a `DeploymentHistory` row at each step (that's the "log" users see), and update `Deployment.status` as you go:

1. Load the database, its service, server and SSH key. Decrypt the passwords.
2. Deployment → `DEPLOYING`, `startedAt = now`.
3. `withSsh(...)`, then inside one session:
   1. `ensureNetwork`, `ensureVolume`
   2. **Write the env file** with `umask 077` to `/tmp/warden-<id>.env`, sending the content over **stdin**, not in the command (so passwords never show in `ps` or shell history). This needs a small addition to `ssh-client`'s `run`: an optional `input` that is written to the command's stdin. In ssh2 that's `stream.write(input); stream.end();` after `exec`.
   3. `runContainer(...)` with `--env-file`
   4. **always** `rm -f /tmp/warden-<id>.env` afterwards, in a `finally`
   5. Deployment → `HEALTH_CHECK`. Poll `healthStatus` every 3 s, up to ~120 s (MySQL on a 1 GB server is slow on first boot)
4. Healthy → deployment `SUCCESS` (`finishedAt`), service `HEALTHY`, notify `deploy.succeeded`.
5. Anything fails → `docker rm -f` the container, **and `docker volume rm` the volume only if this was a brand-new database** (it's empty). Deployment `FAILED` with the reason in history, service `FAILED`, notify `deploy.failed`.

**`restart`:** `docker restart`, then the same health wait.

**`remove`:** `docker rm -f` the container. `docker volume rm` only if `deleteData`. Then delete the `Service` row (it cascades to `ServiceDatabase`) and the auto-created variable, in one transaction. **Leave the network**: other databases in the environment may use it.

**Done when:** on the test server, all 3 engines come up `healthy`, `docker ps` shows no published ports, and a forced failure (e.g. a wrong image tag) leaves no container behind.

## A6. The frontend

1. **Add service → Database** (`AddServiceModal`): engine cards, version (defaults to the newest), server (Deploy servers only), variable name (pre-filled per engine).
   - **Memory warning:** read the server's latest `/server-metrics` (`memory.totalBytes - memory.usedBytes`). If it's less than the engine's `idleMemoryMb`, show a warning (don't block).
2. **Database page**: when `ServicePage` sees `type === "DATABASE"`, show:
   - engine and version, status, server, container name
   - the connection string (masked; Reveal + Copy)
   - Restart; Delete (with "Also delete all data" unticked by default, and type-the-name when ticked)
   - the latest deployment's history lines, refreshed while it's running (copy how `useCleanups` polls)
3. **Canvas:** the database icon is already in `ServiceNode`.
4. Hooks in `features/databases/hooks/useDatabases.ts`, following the other features.

**Done when:** you can create each engine from the UI, watch it go Deploying → Health check → Live, reveal and copy the connection string, restart, and delete (both with and without data).

## A7. Test checklist (Part A)

- [ ] Postgres 18, MySQL 9.7 and Redis 8.10 all become Healthy
- [ ] Postgres 16 also works (the old data path)
- [ ] The auto-created variable exists, is a secret, and connects (`docker run --rm --network warden-env-… postgres:18 psql "<url>" -c 'select 1'`)
- [ ] `docker ps` shows **no** `0.0.0.0:` ports
- [ ] Data survives Restart (create a table, restart, it's still there)
- [ ] Delete, keeping data → volume still exists; deleting data → volume gone
- [ ] Wrong image tag → Failed with a reason, nothing left on the server
- [ ] Home shows the deployments; the Activity tab shows the audit lines
- [ ] Another org's ids → 404

---

# Part B: Backups to R2

## B0. Local storage to test with (MinIO)

Add MinIO to `infra/docker-compose.yml` (image `minio/minio`, command `server /data --console-address :9001`, ports 9000 + 9001, a user and password). Create a bucket in its console at `localhost:9001`.

Your code only ever sees **"an S3 endpoint + bucket + keys"**: MinIO locally, R2 for real. Only `.env` changes.

## B1. Where backups go (storage settings)

**Platform default** (your bucket), in **both** `apps/api/.env` and `apps/worker/.env`:

```
BACKUP_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com   # MinIO locally: http://localhost:9000
BACKUP_S3_BUCKET=warden-backups
BACKUP_S3_ACCESS_KEY_ID=…
BACKUP_S3_SECRET_ACCESS_KEY=…
```

R2 needs `region: "auto"`; MinIO needs `forcePathStyle: true`.

**Bring your own:** model `BackupStorage` (one per org, `organizationId @unique`): endpoint, bucket, access key id, **secret encrypted with the org key**. A **Settings → Backup storage** page with **Test connection** (upload and delete a tiny file).

**Which one is used:** the org's own if set, else the platform's. **Save which one on every backup row** (`storage: "PLATFORM" | "ORG"` + bucket), so old backups stay downloadable after an org switches.

File layout in the bucket: `orgs/<orgId>/databases/<serviceId>/<timestamp>.<ext>.enc`.

❓ **Open question:** who may change an org's backup storage: DevOps+ (it's infrastructure) or Admin only? Ask Claude/decide before B1.

## B2. A new package: `packages/storage`

Both the API (download, test) and the worker (upload, delete) need the same code, so it's a package, like `ssh-client`. Dependencies: `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`.

- `uploadStream(target, key, readable)`: use `Upload` from `@aws-sdk/lib-storage`. It handles streams of unknown size by uploading in parts
- `downloadStream(target, key)`, `deleteObject`, `testConnection`
- **Encryption** (`encrypt-stream.ts`): `crypto.createCipheriv('aes-256-gcm', dek, iv)` with a random 12-byte `iv`. Pipe the dump through it. Keep the `iv` and the final `cipher.getAuthTag()` on the backup row
- ⚠️ **GCM only checks the data at the very end.** When restoring, **decrypt to a temporary file on the worker first**; only if `decipher.final()` succeeds (the tag matches) do you feed it to the database. Never stream unverified data straight into a restore

## B3. Streaming over SSH (`packages/ssh-client`)

Today `run()` collects all output into a string. A 2 GB dump can't work like that. Add **`stream(cmd)`**, returning `{ stdout: Readable, stdin: Writable, done: Promise<{ code, stderr }> }`. In ssh2, the `exec` callback's `stream` already *is* a duplex stream, so you just hand it out instead of reading it all.

## B4. The models

- On `ServiceDatabase`: `backupEnabled` (default true), `backupHourUtc` (default 2), `backupRetentionDays` (default **7**)
- New `DatabaseBackup`: `id`, `serviceId`, `organizationId`, `status` (QUEUED / RUNNING / SUCCESS / FAILED), `trigger` (SCHEDULED / MANUAL), `storage`, `bucket`, `objectKey`, `sizeBytes`, `iv`, `authTag`, `error`, `startedAt`, `finishedAt`, `createdAt`. Index `(serviceId, createdAt)`

## B5. The backup job (worker)

What runs inside the container, per engine:

| Engine | Dump command (inside `docker exec <container> sh -c '…'`) | File |
|---|---|---|
| Postgres | `pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom` (already compressed) | `.dump` |
| MySQL | `mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers "$MYSQL_DATABASE"`, then `gzip` | `.sql.gz` |
| Redis | `redis-cli --rdb` to stdout. ⚠️ **check this works on 8.x when you get here**; the fallback is `BGSAVE`, then `docker cp <container>:/data/dump.rdb -` | `.rdb` |

Flow: `ssh.stream(dump)` → `stdout` → encrypt → `uploadStream` → save size, `iv`, tag → `SUCCESS`.

**Then retention:** delete backups older than `backupRetentionDays` (object + row). ⚠️ **Never delete the newest successful backup**, even if it's older than the limit: a database that's been off for 10 days still needs its last backup.

**Schedule:** an hourly `backup-tick` (a job scheduler, like `metrics-tick`) queues a backup for each database whose `backupHourUtc` is this hour and that has no backup today. Deduplicate by service. Store the hour in **UTC**; the UI converts to local time.

**Failure:** row `FAILED` + reason; notify a new event `database.backup_failed` (add it to `NotificationEventSchema` and give it an email/chat template in `packages/notifier`).

⚠️ Long jobs: a big dump can take minutes. That's fine for BullMQ (it keeps renewing the job's lock while the worker is busy), but give the backup worker `concurrency: 1` or 2 so one server isn't asked for several dumps at once.

## B6. Restore (worker)

1. Download → decrypt to a temp file → **check the tag** (B2). Fail here = nothing touched.
2. Postgres: `docker exec -i <c> sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner'` with the file on stdin.
3. MySQL: `gunzip`, then `docker exec -i <c> sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'`.
4. Redis: ⚠️ the trickiest one. Because we run Redis with `--appendonly yes`, on start it loads the **AOF files, not** `dump.rdb`. So: stop the container → remove the `appendonlydir` in the volume → copy the `.rdb` in as `dump.rdb` → start it → it rebuilds the AOF. Ask Claude before writing this one.
5. Always delete the temp file. Record a deployment-style history and audit `database.backup_restored`.

## B7. API + frontend

| Route | Who |
|---|---|
| `GET /database-backups?serviceId=` | Everyone (list) |
| `POST /database-backups` `{ serviceId }` | Developer+ (back up now) |
| `POST /database-backups/:id/restore` `{ confirmName }` | Developer+ |
| `GET /database-backups/:id/download` | Developer+. Streams from storage → decrypts → to the browser. **Audit-logged** (`database.backup_downloaded`): a dump is all of a customer's data |
| `PATCH /databases/:serviceId/backup-settings` | Developer+ (on/off, hour, retention days) |
| `GET/PUT /backup-storage`, `POST /backup-storage/test` | (decide: DevOps+ or Admin) |

Frontend: a **Backups** tab on the database page (settings, list with size and status, Back up now, Download, Restore with type-the-name), and **Settings → Backup storage**.

## B8. Test checklist (Part B)

- [ ] Back up now → a file appears in MinIO, and it's **not** readable as SQL (encrypted)
- [ ] Download → a readable dump
- [ ] Restore: change data, restore, the old data is back
- [ ] A tampered file (change one byte in MinIO) → restore **refuses**, database untouched
- [ ] Retention: with fake old rows, only ones past the limit go, and the newest successful one always stays
- [ ] An org's own storage overrides the platform's; switching keeps old backups downloadable
- [ ] Then the same on your real R2 bucket

---

## When you get stuck

Send Claude: the stage (e.g. "A5 step 3.2"), what you expected, what happened (error text), and the diff. The parts most likely to need help: **A0** (socket permissions), **A5** (stdin to SSH), **B3** (streams), **B6 Redis restore**.
