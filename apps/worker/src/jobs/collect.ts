import { prisma, type Prisma, type ServerStatus } from "db";
import { DockerError, diskUsage, listContainers, type DockerDisk } from "docker-client";
import { withSsh } from "ssh-client";
import { env } from "../env";
import { HOST_COMMAND, parseHost, percentOf, type HostMetrics } from "../host";
import { sshTargetFor } from "../keys";
import { log } from "../log";
import { notify, serverUrl } from "../notify";
import { countFailure, flags, hasFlag, redis, setFlag } from "../redis";
import { diskAlert, statusAfterFailure, statusAfterSuccess } from "../status";

/** `docker system df` is slow on busy hosts; the pie chart doesn't need it every minute. */
const DOCKER_DISK_EVERY_MS = 10 * 60 * 1000;

type Containers = Awaited<ReturnType<typeof listContainers>>;
interface Poll {
  host: HostMetrics;
  containers: Containers | null;
  disk: DockerDisk | null;
  dockerProblem: string | null;
}

const SERVER_FOR_POLL = {
  serverSshKey: { select: { privateKeyEncrypted: true } },
  organization: { select: { organizationName: true } },
} satisfies Prisma.ServerInclude;
type ServerRow = Prisma.ServerGetPayload<{ include: typeof SERVER_FOR_POLL }>;

/** One poll of one server: SSH in once, read everything, write it in one transaction. */
export async function collectServer(serverId: string): Promise<void> {
  const server = await prisma.server.findUnique({
    where: { id: serverId },
    include: SERVER_FOR_POLL,
  });
  if (!server) return; // deleted since the tick

  let poll: Poll;
  try {
    const wantDisk = await dockerDiskDue(serverId);
    poll = await withSsh(await sshTargetFor(server), async (run) => {
      const out = await run(HOST_COMMAND);
      if (out.code !== 0) throw new Error(out.stderr.trim().split("\n")[0] || "couldn't read system stats");
      const host = parseHost(out.stdout);
      try {
        const containers = await listContainers(run);
        return { host, containers, disk: wantDisk ? await diskUsage(run) : null, dockerProblem: null };
      } catch (e) {
        // Docker missing or not allowed: the host numbers are still worth keeping.
        if (e instanceof DockerError) return { host, containers: null, disk: null, dockerProblem: e.message };
        throw e;
      }
    });
  } catch (e) {
    await onFailure(server, (e as Error).message);
    return;
  }
  await onSuccess(server, poll);
}


async function onSuccess(server: ServerRow, { host, containers, disk, dockerProblem }: Poll) {
  const now = new Date();
  const memory = percentOf(host.memoryUsedBytes, host.memoryTotalBytes);
  const diskPct = percentOf(host.diskUsedBytes, host.diskTotalBytes);
  const running = containers ? containers.filter((c) => c.state === "running").length : null;
  const status = statusAfterSuccess(running);

  await prisma.$transaction([
    prisma.serverMetrics.create({
      data: {
        serverId: server.id,
        cpuUsage: host.cpuPercent,
        memoryUsage: memory,
        diskUsage: diskPct,
        memoryUsedBytes: host.memoryUsedBytes,
        memoryTotalBytes: host.memoryTotalBytes,
        diskUsedBytes: host.diskUsedBytes,
        diskTotalBytes: host.diskTotalBytes,
        load1: host.load1,
        load5: host.load5,
        load15: host.load15,
        createdAt: now,
      },
    }),
    // Containers are current state: upsert what's there, delete what's gone.
    // Skipped entirely when Docker couldn't answer, so the last known list stays.
    ...(containers
      ? [
          ...containers.map((c) => {
            const data = {
              containerName: c.name,
              image: c.image,
              state: c.state,
              health: c.health,
              statusText: c.statusText,
              containerCpuUsage: c.cpu,
              containerMemoryUsage: c.memoryBytes,
              containerMemoryLimit: c.memoryLimitBytes,
            };
            return prisma.serverContainer.upsert({
              where: { serverId_dockerId: { serverId: server.id, dockerId: c.id } },
              create: { serverId: server.id, dockerId: c.id, ...data },
              update: data,
            });
          }),
          prisma.serverContainer.deleteMany({ where: { serverId: server.id, dockerId: { notIn: containers.map((c) => c.id) } } }),
        ]
      : []),
    ...(disk
      ? [
          prisma.dockerDiskMetrics.create({
            data: {
              serverId: server.id,
              totalDiskUsage: disk.total,
              imageSize: disk.images,
              volumeSize: disk.volumes,
              buildCacheSize: disk.buildCache,
              containerSize: disk.containers,
              reclaimableSize: disk.reclaimable,
              createdAt: now,
            },
          }),
        ]
      : []),
    prisma.server.update({ where: { id: server.id }, data: { status, lastSeenAt: now } }),
  ]);
  await redis.del(flags.failures(server.id));
  // Log Docker trouble when it starts and when it ends, not on every poll.
  const dockerWasMissing = await hasFlag(flags.dockerMissing(server.id));
  if (dockerProblem && !dockerWasMissing) {
    await setFlag(flags.dockerMissing(server.id));
    log.warn(`${server.serverName}: ${dockerProblem}`);
  } else if (!dockerProblem && dockerWasMissing) {
    await redis.del(flags.dockerMissing(server.id));
    log.info(`${server.serverName}: Docker is available again`);
  }

  const base = { organizationName: server.organization.organizationName, serverName: server.serverName, serverIp: server.serverIp, at: now, url: serverUrl(server.id) };

  // Back online, only after an outage we actually announced.
  if (await hasFlag(flags.offlineAlerted(server.id))) {
    await redis.del(flags.offlineAlerted(server.id));
    log.info(`${server.serverName} is back online`);
    await notify(server.organizationId, "server.recovered", { ...base, lastSeenAt: server.lastSeenAt });
  }

  const alerted = await hasFlag(flags.diskAlerted(server.id));
  const action = diskAlert(diskPct, env.DISK_HIGH_PERCENT, alerted);
  if (action === "alert") {
    await setFlag(flags.diskAlerted(server.id));
    log.info(`${server.serverName} disk at ${diskPct}%`);
    await notify(server.organizationId, "server.disk_high", { ...base, diskUsagePercent: diskPct, thresholdPercent: env.DISK_HIGH_PERCENT });
  } else if (action === "rearm") {
    await redis.del(flags.diskAlerted(server.id));
  }
}

async function onFailure(server: ServerRow, reason: string) {
  const failures = await countFailure(server.id);
  const status: ServerStatus = statusAfterFailure(server.status, failures);
  log.warn(`${server.serverName}: poll failed (${failures} in a row): ${reason}`);
  if (status === server.status) return;

  await prisma.server.update({ where: { id: server.id }, data: { status } });
  // A server that was never reachable doesn't "go" offline; only a known-good one does.
  if (status === "OFFLINE" && server.lastSeenAt && !(await hasFlag(flags.offlineAlerted(server.id)))) {
    await setFlag(flags.offlineAlerted(server.id));
    await notify(server.organizationId, "server.offline", {
      organizationName: server.organization.organizationName,
      serverName: server.serverName,
      serverIp: server.serverIp,
      at: new Date(),
      lastSeenAt: server.lastSeenAt,
      reason,
      url: serverUrl(server.id),
    });
  }
}

async function dockerDiskDue(serverId: string): Promise<boolean> {
  const last = await prisma.dockerDiskMetrics.findFirst({ where: { serverId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  return !last || Date.now() - last.createdAt.getTime() >= DOCKER_DISK_EVERY_MS;
}
