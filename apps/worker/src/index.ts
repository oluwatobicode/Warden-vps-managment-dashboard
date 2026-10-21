import { env } from "./env";
import { Worker, type Job } from "bullmq";
import { prisma } from "db";
import { BACKUP_JOBS, BackupJobSchema, CleanupJobSchema, CollectServerJobSchema, DatabaseJobSchema, MONITORING_JOBS, QUEUES } from "shared-types";
import { cleanup } from "./jobs/cleanup";
import { databaseJob } from "./jobs/database";
import { backupJob, backupTick } from "./jobs/backup";
import { collectServer } from "./jobs/collect";
import { pruneMetrics } from "./jobs/prune";
import { tick } from "./jobs/tick";
import { log } from "./log";
import { backupQueue, monitoringQueue } from "./queues";
import { redis } from "./redis";

/*
 * Warden's worker: the jobs that talk to servers, so the api never waits on SSH.
 *   monitoring queue: metrics-tick (every MONITOR_INTERVAL_SECONDS) fans out
 *                     one collect-server job per server; prune-metrics hourly
 *   docker-cleanup:   enqueued by the api when someone presses Run cleanup
 * Every job payload is checked against its shared-types schema before use.
 */

async function monitoringJob(job: Job): Promise<void> {
  switch (job.name) {
    case MONITORING_JOBS.tick: {
      const n = await tick();
      if (n) log.info(`tick: polling ${n} server(s)`);
      return;
    }
    case MONITORING_JOBS.collect:
      return collectServer(CollectServerJobSchema.parse(job.data).serverId);
    case MONITORING_JOBS.prune:
      return pruneMetrics();
    default:
      log.warn(`unknown monitoring job "${job.name}", skipped`);
  }
}

async function main() {
  await prisma.$queryRaw`SELECT 1`;
  await redis.ping();
  log.info("worker connected to postgres and redis");

  // Idempotent: safe on every boot, and changing the interval just updates it.
  await monitoringQueue.upsertJobScheduler(MONITORING_JOBS.tick, { every: env.MONITOR_INTERVAL_SECONDS * 1000 }, { name: MONITORING_JOBS.tick });
  await monitoringQueue.upsertJobScheduler(MONITORING_JOBS.prune, { every: 3600 * 1000 }, { name: MONITORING_JOBS.prune });
  await backupQueue.upsertJobScheduler(BACKUP_JOBS.tick, { every: 15 * 60 * 1000 }, { name: BACKUP_JOBS.tick });

  const workers = [
    new Worker(QUEUES.monitoring, monitoringJob, { connection: redis, concurrency: env.MONITOR_CONCURRENCY }),
    new Worker(QUEUES.cleanup, (job) => cleanup(CleanupJobSchema.parse(job.data)), { connection: redis, concurrency: 2 }),
    // A first MySQL boot can take minutes; a few at once is plenty.
    new Worker(QUEUES.databases, (job) => databaseJob(DatabaseJobSchema.parse(job.data)), { connection: redis, concurrency: 3 }),
    // One dump per server at a time is enough load; big dumps take minutes.
    new Worker(
      QUEUES.backups,
      async (job) => {
        if (job.name === BACKUP_JOBS.tick) {
          const n = await backupTick();
          if (n) log.info(`backup tick: queued ${n} backup(s)`);
          return;
        }
        return backupJob(BackupJobSchema.parse(job.data));
      },
      { connection: redis, concurrency: 2 },
    ),
  ];
  for (const w of workers) {
    w.on("failed", (job, err) => log.error(`${w.name}/${job?.name ?? "?"} failed: ${err.message}`));
    w.on("error", (err) => log.error(`${w.name}: ${err.message}`));
  }
  log.info(`polling every ${env.MONITOR_INTERVAL_SECONDS}s, ${env.MONITOR_CONCURRENCY} at a time${env.NOTIFY_DRY_RUN ? ", alerts in dry-run" : ""}`);

  // Let running jobs finish their writes before exiting.
  let stopping = false;
  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    log.info(`${signal}: finishing current jobs`);
    await Promise.all(workers.map((w) => w.close()));
    await Promise.all([monitoringQueue.close(), backupQueue.close()]);
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => void stop("SIGTERM"));
  process.on("SIGINT", () => void stop("SIGINT"));
}

main().catch((e) => {
  log.error(`worker failed to start: ${(e as Error).message}`);
  process.exit(1);
});
