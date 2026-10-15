import { prisma } from "db";
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
