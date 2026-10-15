import { prisma } from "db";
import { MONITORING_JOBS, type CollectServerJob } from "shared-types";
import { monitoringQueue } from "../queues";

/**
 * Every interval: one collect job per server. Reading the server list from
 * Postgres each time means a new or deleted server needs no extra wiring.
 * Deduplicated by server: if last minute's poll of a slow server is still
 * running, no second one piles up behind it.
 */
export async function tick(): Promise<number> {
  const servers = await prisma.server.findMany({ select: { id: true } });
  await Promise.all(
    servers.map((s) =>
      monitoringQueue.add(MONITORING_JOBS.collect, { serverId: s.id } satisfies CollectServerJob, {
        deduplication: { id: `collect-${s.id}` },
      }),
    ),
  );
  return servers.length;
}
