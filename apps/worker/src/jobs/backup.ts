import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip, createGzip } from "node:zlib";
import { prisma, type DeploymentStatus, type Prisma } from "db";
import { healthStatus, q, removeContainer, removeFile, waitHealthy, writePrivateFile, type Run } from "docker-client";
import { BACKUP_JOBS, DATABASE_CATALOG, type BackupJob } from "shared-types";
import { withSsh, type Stream } from "ssh-client";
import { decryptStream, deleteObject, downloadStream, encryptStream, uploadStream } from "storage";
import { env } from "../env";
import { activeStorage, storageOf } from "../backups/storage";
import { BACKUP, envFileFor } from "../databases/engines";
import { getDek, sshTargetFor, unseal } from "../keys";
import { log } from "../log";
import { notify } from "../notify";
import { backupQueue } from "../queues";

const WITH_EVERYTHING = {
  service: {
    include: {
      server: { include: { serverSshKey: { select: { privateKeyEncrypted: true } } } },
      environment: { include: { project: { select: { id: true, projectName: true } } } },
    },
  },
  organization: { select: { organizationName: true } },
} satisfies Prisma.ServiceDatabaseInclude;
type Db = Prisma.ServiceDatabaseGetPayload<{ include: typeof WITH_EVERYTHING }>;

export async function backupJob(job: BackupJob): Promise<void> {
  const db = await prisma.serviceDatabase.findFirst({
    where: { serviceId: job.serviceId, organizationId: job.organizationId },
    include: WITH_EVERYTHING,
  });
  if (!db) return;
  if (job.action === "backup") return backup(db, job.backupId);
  if (job.deploymentId) return restore(db, job.backupId, job.deploymentId);
}

// ── backup ────────────────────────────────────────────────────────────────

/**
 * Dump → (gzip) → encrypt with the org's key → upload, as one stream: the
 * dump never sits whole in memory or on any disk. Then drop old backups.
 */
async function backup(db: Db, backupId: string): Promise<void> {
  const row = await prisma.databaseBackup.findFirst({ where: { id: backupId, serviceId: db.serviceId } });
  if (!row || row.status !== "QUEUED") return;
  const server = db.service.server;
  const spec = BACKUP[db.engine];
  let uploadedKey: string | null = null;
  let where: Awaited<ReturnType<typeof activeStorage>> = null;

  try {
    where = await activeStorage(db.organizationId);
    if (!where) throw new Error("No backup storage is set up (Settings → Backup storage)");
    if (!server) throw new Error("The database has no server");
    const key = `orgs/${db.organizationId}/databases/${db.serviceId}/${new Date().toISOString().replace(/[:.]/g, "-")}.${spec.ext}.enc`;
    await prisma.databaseBackup.update({
      where: { id: row.id },
      data: { status: "RUNNING", startedAt: new Date(), storage: where.kind, bucket: where.target.bucket, objectKey: key },
    });

    const dek = await getDek(db.organizationId);
    const seal = encryptStream(dek);
    let bytes = 0;
    const counter = new PassThrough();
    counter.on("data", (c: Buffer) => (bytes += c.length));

    const target = await sshTargetFor({ ...server, organizationId: db.organizationId });
    await withSsh(target, async (_run, stream) => {
      const exec = await stream(`docker exec ${q(db.containerName)} sh -c ${q(spec.dump)}`);
      exec.stdin.end();
      uploadedKey = key;
      const steps = [exec.stdout, ...(spec.gzip ? [createGzip()] : []), seal.stream, counter] as const;
      const [, , result] = await Promise.all([
        uploadStream(where!.target, key, counter),
        pipeline(...(steps as unknown as [NodeJS.ReadableStream, NodeJS.WritableStream])),
        exec.done,
      ]);
      if (result.code !== 0) throw new Error(`The dump failed: ${result.stderr.trim().split("\n").filter((l) => !/Using a password/i.test(l))[0] ?? `exit code ${result.code}`}`);
    });

    await prisma.databaseBackup.update({
      where: { id: row.id },
      data: { status: "SUCCESS", sizeBytes: bytes, iv: seal.iv, authTag: seal.authTag(), finishedAt: new Date() },
    });
    log.info(`backup of ${db.service.serviceName}: ${Math.round(bytes / 1024)} kB to ${where.kind.toLowerCase()} storage`);
    await prune(db);
  } catch (e) {
    const reason = (e as Error).message;
    log.warn(`backup of ${db.service.serviceName} failed: ${reason}`);
    if (uploadedKey && where) await deleteObject(where.target, uploadedKey).catch(() => undefined);
    await prisma.databaseBackup.update({
      where: { id: row.id },
      data: { status: "FAILED", error: reason.slice(0, 2000), finishedAt: new Date(), objectKey: null },
    });
    await notify(db.organizationId, "database.backup_failed", {
      organizationName: db.organization.organizationName,
      projectName: db.service.environment.project.projectName,
      databaseName: db.service.serviceName,
      engine: DATABASE_CATALOG[db.engine].label,
      serverName: server?.serverName,
      at: new Date(),
      reason,
      url: env.APP_URL ? `${env.APP_URL.replace(/\/$/, "")}/projects/${db.service.environment.project.id}/services/${db.serviceId}` : undefined,
    });
  }
}

/**
 * Delete backups older than the database's retention, file and row. The
 * newest successful backup always stays, however old: a database that's
 * been off for weeks still needs its last copy.
 */
async function prune(db: Db): Promise<void> {
  const cutoff = new Date(Date.now() - db.backupRetentionDays * 24 * 3600 * 1000);
  const newest = await prisma.databaseBackup.findFirst({
    where: { serviceId: db.serviceId, status: "SUCCESS" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const old = await prisma.databaseBackup.findMany({
    where: { serviceId: db.serviceId, createdAt: { lt: cutoff }, status: { in: ["SUCCESS", "FAILED"] }, ...(newest ? { id: { not: newest.id } } : {}) },
  });
  for (const b of old) {
    if (b.objectKey) {
      const t = await storageOf(db.organizationId, b.storage, b.bucket);
      if (t) await deleteObject(t, b.objectKey).catch(() => undefined);
    }
    await prisma.databaseBackup.delete({ where: { id: b.id } });
  }
  if (old.length) log.info(`pruned ${old.length} old backup(s) of ${db.service.serviceName}`);
}

// ── restore ───────────────────────────────────────────────────────────────

/**
 * Download → decrypt to a temporary file → only if the encryption check
 * passes, feed it to the database. Logged as a deployment, like a restart.
 */
async function restore(db: Db, backupId: string, deploymentId: string): Promise<void> {
  const step = (status: DeploymentStatus, message: string) =>
    prisma.$transaction([
      prisma.deployment.update({ where: { id: deploymentId }, data: { deploymentStatus: status } }),
      prisma.deploymentHistory.create({ data: { deploymentId, status, message } }),
    ]);
  const dir = await mkdtemp(join(tmpdir(), "warden-restore-"));
  const file = join(dir, "backup");
  await prisma.deployment.update({ where: { id: deploymentId }, data: { startedAt: new Date() } });

  try {
    const b = await prisma.databaseBackup.findFirst({ where: { id: backupId, serviceId: db.serviceId, status: "SUCCESS" } });
    if (!b?.objectKey || !b.iv || !b.authTag) throw new Error("That backup can't be restored (it didn't finish)");
    const server = db.service.server;
    if (!server) throw new Error("The database has no server");
    const t = await storageOf(db.organizationId, b.storage, b.bucket);
    if (!t) throw new Error("The storage this backup was saved to is no longer set up");

    await step("DEPLOYING", "Downloading and checking the backup");
    const dek = await getDek(db.organizationId);
    try {
      await pipeline(await downloadStream(t, b.objectKey), decryptStream(dek, b.iv, b.authTag), createWriteStream(file, { mode: 0o600 }));
    } catch {
      throw new Error("The backup failed its integrity check (changed, corrupted or the wrong key). Nothing was changed");
    }

    const target = await sshTargetFor({ ...server, organizationId: db.organizationId });
    await withSsh(target, async (run, stream) => {
      await step("DEPLOYING", "Restoring the data");
      if (db.engine === "REDIS") await restoreRedis(run, stream, db, file);
      else await restoreSql(stream, db, file);
      await step("HEALTH_CHECK", "Waiting for the database to answer");
      await waitHealthy(run, db.containerName);
    });

    const when = b.createdAt.toISOString().replace("T", " ").slice(0, 16);
    await prisma.$transaction([
      prisma.deployment.update({ where: { id: deploymentId }, data: { deploymentStatus: "SUCCESS", finishedAt: new Date() } }),
      prisma.deploymentHistory.create({ data: { deploymentId, status: "SUCCESS", message: `Restored the backup from ${when} UTC` } }),
      prisma.service.update({ where: { id: db.serviceId }, data: { status: "HEALTHY" } }),
    ]);
    log.info(`restored ${db.service.serviceName} from backup ${backupId}`);
  } catch (e) {
    const reason = (e as Error).message;
    log.warn(`restore of ${db.service.serviceName} failed: ${reason}`);
    // Most failures (bad file, a SQL error) leave the database up: say so.
    let up = false;
    if (db.service.server) {
      const target = await sshTargetFor({ ...db.service.server, organizationId: db.organizationId }).catch(() => null);
      if (target) up = await withSsh(target, async (run) => (await healthStatus(run, db.containerName)) === "healthy").catch(() => false);
    }
    await prisma.$transaction([
      prisma.deployment.update({ where: { id: deploymentId }, data: { deploymentStatus: "FAILED", finishedAt: new Date() } }),
      prisma.deploymentHistory.create({ data: { deploymentId, status: "FAILED", message: reason.slice(0, 4000) } }),
      prisma.service.update({ where: { id: db.serviceId }, data: { status: up ? "HEALTHY" : "FAILED" } }),
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Postgres / MySQL: stream the file into the restore command inside the container. */
async function restoreSql(stream: Stream, db: Db, file: string) {
  const spec = BACKUP[db.engine];
  const exec = await stream(`docker exec -i ${q(db.containerName)} sh -c ${q(spec.restore!)}`);
  exec.stdout.resume(); // nothing useful there, but unread output would stall the channel
  await pipeline(...([createReadStream(file), ...(spec.gzip ? [createGunzip()] : []), exec.stdin] as unknown as [NodeJS.ReadableStream, NodeJS.WritableStream]));
  const r = await exec.done;
  if (r.code !== 0) throw new Error(`The restore failed: ${r.stderr.trim().split("\n").filter((l) => !/Using a password/i.test(l))[0] ?? `exit code ${r.code}`}`);
}

/**
 * Redis runs with --appendonly yes, which loads its AOF files on start and
 * IGNORES dump.rdb. So: stop it → put the snapshot in place and drop the AOF
 * → start a temporary Redis with AOF off (it loads the snapshot) → switch AOF
 * on, which rewrites the AOF from the loaded data → shut it down → start the
 * real container. (Proven step by step against Redis 8.10.)
 */
async function restoreRedis(run: Run, stream: Stream, db: Db, file: string) {
  const image = `${DATABASE_CATALOG.REDIS.image}:${db.version}`;
  const tmp = `${db.containerName}-restore`;
  const envFile = `/tmp/warden-${tmp}.env`;
  const cli = 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli';
  const must = async (cmd: string, what: string) => {
    const r = await run(cmd);
    if (r.code !== 0) throw new Error(`${what}: ${(r.stderr || r.stdout).trim().split("\n")[0]}`);
    return r.stdout;
  };

  await must(`docker stop ${q(db.containerName)}`, "Couldn't stop Redis");
  try {
    const put = await stream(`docker run --rm -i -v ${q(`${db.volumeName}:/data`)} ${q(image)} sh -c ${q("rm -rf /data/appendonlydir && cat > /data/dump.rdb && chown redis:redis /data/dump.rdb")}`);
    put.stdout.resume();
    await pipeline(createReadStream(file), createGunzip(), put.stdin);
    if ((await put.done).code !== 0) throw new Error("Couldn't put the snapshot in place");

    const password = await unseal(db.organizationId, db.passwordEncrypted);
    await writePrivateFile(run, envFile, envFileFor("REDIS", { password, rootPassword: null, databaseName: null, username: null }));
    try {
      await removeContainer(run, tmp);
      await must(
        `docker run -d --name ${q(tmp)} -v ${q(`${db.volumeName}:/data`)} --env-file ${q(envFile)} ${q(image)} sh -c ${q('exec docker-entrypoint.sh redis-server --appendonly no --requirepass "$REDIS_PASSWORD"')}`,
        "Couldn't start Redis to load the snapshot",
      );
    } finally {
      await removeFile(run, envFile);
    }
    await waitFor(async () => (await run(`docker exec ${q(tmp)} sh -c ${q(`${cli} ping`)}`)).stdout.includes("PONG"), "Redis didn't load the snapshot");
    await must(`docker exec ${q(tmp)} sh -c ${q(`${cli} config set appendonly yes`)}`, "Couldn't switch AOF on");
    await waitFor(async () => {
      const info = (await run(`docker exec ${q(tmp)} sh -c ${q(`${cli} info persistence`)}`)).stdout;
      return /aof_enabled:1/.test(info) && /aof_rewrite_in_progress:0/.test(info) && /aof_rewrite_scheduled:0/.test(info);
    }, "Redis didn't finish writing its AOF");
    await run(`docker exec ${q(tmp)} sh -c ${q(`${cli} shutdown`)}`);
    await removeContainer(run, tmp);
  } finally {
    await must(`docker start ${q(db.containerName)}`, "Couldn't start Redis again");
  }
}

async function waitFor(check: () => Promise<boolean>, failure: string, timeoutMs = 60_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(failure);
}

// ── the daily schedule ────────────────────────────────────────────────────

/**
 * Every 15 minutes: queue a backup for each database whose backup hour (UTC)
 * is now and that hasn't had one in the last 20 hours.
 */
export async function backupTick(): Promise<number> {
  // A worker that died mid-backup leaves a row that would block the next one.
  await prisma.databaseBackup.updateMany({
    where: { status: { in: ["QUEUED", "RUNNING"] }, createdAt: { lt: new Date(Date.now() - 6 * 3600 * 1000) } },
    data: { status: "FAILED", error: "Interrupted (the worker stopped)", finishedAt: new Date(), objectKey: null },
  });
  const hour = new Date().getUTCHours();
  const due = await prisma.serviceDatabase.findMany({
    where: { backupEnabled: true, backupHourUtc: hour, service: { status: { in: ["HEALTHY", "DEGRADED"] } } },
    select: { serviceId: true, organizationId: true },
  });
  const since = new Date(Date.now() - 20 * 3600 * 1000);
  let queued = 0;
  for (const d of due) {
    const recent = await prisma.databaseBackup.findFirst({ where: { serviceId: d.serviceId, createdAt: { gte: since } }, select: { id: true } });
    if (recent) continue;
    // Being restored or restarted right now: the next tick (in 15 min) tries again.
    const busy = await prisma.deployment.findFirst({
      where: { serviceId: d.serviceId, deploymentStatus: { in: ["QUEUED", "BUILDING", "DEPLOYING", "HEALTH_CHECK"] } },
      select: { id: true },
    });
    if (busy) continue;
    const where = await activeStorage(d.organizationId);
    const row = await prisma.databaseBackup.create({
      data: where
        ? { serviceId: d.serviceId, organizationId: d.organizationId, trigger: "SCHEDULED", storage: where.kind }
        : { serviceId: d.serviceId, organizationId: d.organizationId, trigger: "SCHEDULED", storage: "PLATFORM", status: "FAILED", error: "No backup storage is set up (Settings → Backup storage)", finishedAt: new Date() },
    });
    if (!where) continue;
    await backupQueue.add(BACKUP_JOBS.run, { action: "backup", backupId: row.id, serviceId: d.serviceId, organizationId: d.organizationId } satisfies BackupJob);
    queued++;
  }
  return queued;
}
