import { prisma } from "db";
import { runCleanup } from "docker-client";
import type { CleanupJob } from "shared-types";
import { withSsh } from "ssh-client";
import { sshTargetFor } from "../keys";
import { log } from "../log";
import { notify, serverUrl } from "../notify";

/**
 * Run cleanup for one DockerCleanupLog row the api created as QUEUED.
 * The row is matched on id + server + org together, so a job can only ever
 * touch a cleanup that belongs to that server's own org.
 */
export async function cleanup({ cleanupId, serverId, organizationId }: CleanupJob): Promise<void> {
  const row = await prisma.dockerCleanupLog.findFirst({
    where: { id: cleanupId, serverId, server: { organizationId } },
    include: { server: { include: { serverSshKey: { select: { privateKeyEncrypted: true } }, organization: { select: { organizationName: true } } } } },
  });
  if (!row || row.status !== "QUEUED") return; // already handled, or gone

  await prisma.dockerCleanupLog.update({ where: { id: row.id }, data: { status: "RUNNING" } });
  const server = row.server;
  let reclaimedBytes = 0;
  let error: string | null = null;
  try {
    const result = await withSsh(await sshTargetFor(server), runCleanup);
    reclaimedBytes = result.reclaimedBytes;
    if (result.failed) error = `${result.failed.key} step failed: ${result.failed.message}`;
  } catch (e) {
    error = (e as Error).message;
  }

  await prisma.dockerCleanupLog.update({
    where: { id: row.id },
    data: { status: error ? "FAILED" : "SUCCESS", reclaimedBytes, errorMessage: error, finishedAt: new Date() },
  });
  log.info(`cleanup on ${server.serverName}: ${error ? `failed (${error})` : "done"}, freed ${Math.round(reclaimedBytes / 1e6)} MB`);

  if (error) {
    await notify(organizationId, "docker.cleanup_failed", {
      organizationName: server.organization.organizationName,
      serverName: server.serverName,
      serverIp: server.serverIp,
      at: new Date(),
      lastSeenAt: server.lastSeenAt,
      reason: error,
      url: serverUrl(server.id),
    });
  }
}
