import { prisma } from "db";
import { LOG_LIMITS } from "shared-types";
import { env } from "../env";
import { log } from "../log";

/** Hourly: drop metric rows past the retention window. */
export async function pruneMetrics(): Promise<void> {
  const before = new Date(Date.now() - env.METRICS_RETENTION_DAYS * 24 * 3600 * 1000);
  const [metrics, disk] = await Promise.all([
    prisma.serverMetrics.deleteMany({ where: { createdAt: { lt: before } } }),
    prisma.dockerDiskMetrics.deleteMany({ where: { createdAt: { lt: before } } }),
  ]);
  if (metrics.count || disk.count) log.info(`pruned ${metrics.count} metric rows, ${disk.count} docker disk rows`);
}

/**
 * Hourly: drop app and server log lines past LOG_LIMITS.retentionDays, 10,000 at a time
 * so a big delete never locks the table for long. Past ~100M rows, daily
 * table partitions (dropping a whole day at once) would be the next step.
 */
export async function pruneServiceLogs(): Promise<void> {
  const before = new Date(Date.now() - LOG_LIMITS.retentionDays * 24 * 3600 * 1000);
  const tables = {
    app: (b: Date) => prisma.$executeRaw`DELETE FROM "ServiceLog" WHERE id IN (SELECT id FROM "ServiceLog" WHERE ts < ${b} LIMIT 10000)`,
    server: (b: Date) => prisma.$executeRaw`DELETE FROM "ServerLog" WHERE id IN (SELECT id FROM "ServerLog" WHERE ts < ${b} LIMIT 10000)`,
  };
  for (const [kind, del] of Object.entries(tables)) {
    let total = 0;
    for (let i = 0; i < 500; i++) {
      const n = await del(before);
      total += n;
      if (n < 10_000) break;
    }
    if (total) log.info(`pruned ${total} ${kind} log line(s)`);
  }
}
