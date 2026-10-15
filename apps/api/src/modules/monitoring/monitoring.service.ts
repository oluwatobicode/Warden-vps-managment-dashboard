import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'db';
import type {
  ContainerHealthSchema,
  MetricPoint,
  ServerContainerList,
  ServerMetrics,
  ServerUsage,
} from 'shared-types';
import type { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { SERVER_MESSAGES } from '../../common/constants/messages.config';

/** The Resources tab shows the last 24 hours (Phase 1 ships one window). */
const WINDOW_HOURS = 24;
/** Chart points are 5-minute averages: 288 a day instead of 1440 raw rows. */
const BUCKET_SECONDS = 300;

const round = (n: number | null | undefined) =>
  n == null ? 0 : Math.round(n * 10) / 10;

/**
 * Reads what the worker collected. Never SSHes anywhere: these endpoints are
 * fast because they only read Postgres. Every method checks the server is in
 * the caller's org first.
 */
@Injectable()
export class MonitoringService {
  constructor(private readonly prisma: PrismaService) {}

  async metrics(orgId: string, serverId: string): Promise<ServerMetrics> {
    await this.assertServerInOrg(orgId, serverId);
    const db = this.prisma.client;
    const since = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000);
    const where = { serverId, createdAt: { gte: since } };

    const [latest, agg, points, docker] = await Promise.all([
      db.serverMetrics.findFirst({ where, orderBy: { createdAt: 'desc' } }),
      db.serverMetrics.aggregate({
        where,
        _avg: { cpuUsage: true, memoryUsage: true, diskUsage: true },
        _max: { cpuUsage: true, memoryUsage: true, diskUsage: true },
      }),
      db.$queryRaw<
        Array<{ at: Date; cpu: number; memory: number; disk: number }>
      >`
        SELECT to_timestamp(floor(extract(epoch FROM "createdAt") / ${BUCKET_SECONDS}) * ${BUCKET_SECONDS}) AS at,
               avg("cpuUsage")::float AS cpu,
               avg("memoryUsage")::float AS memory,
               avg("diskUsage")::float AS disk
        FROM "ServerMetrics"
        WHERE "serverId" = ${serverId} AND "createdAt" >= ${since}
        GROUP BY 1
        ORDER BY 1`,
      db.dockerDiskMetrics.findFirst({
        where: { serverId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      windowHours: WINDOW_HOURS,
      collectedAt: latest?.createdAt.toISOString() ?? null,
      cpu: latest
        ? {
            current: round(latest.cpuUsage),
            peak: round(agg._max.cpuUsage),
            avg: round(agg._avg.cpuUsage),
          }
        : null,
      memory: latest
        ? {
            current: round(latest.memoryUsage),
            peak: round(agg._max.memoryUsage),
            avg: round(agg._avg.memoryUsage),
            usedBytes: latest.memoryUsedBytes,
            totalBytes: latest.memoryTotalBytes,
          }
        : null,
      disk: latest
        ? {
            current: round(latest.diskUsage),
            peak: round(agg._max.diskUsage),
            avg: round(agg._avg.diskUsage),
            usedBytes: latest.diskUsedBytes,
            totalBytes: latest.diskTotalBytes,
          }
        : null,
      load: latest
        ? { one: latest.load1, five: latest.load5, fifteen: latest.load15 }
        : null,
      points: points.map(
        (p): MetricPoint => ({
          at: new Date(p.at).toISOString(),
          cpu: round(p.cpu),
          memory: round(p.memory),
          disk: round(p.disk),
        }),
      ),
      docker: docker
        ? {
            collectedAt: docker.createdAt.toISOString(),
            images: docker.imageSize,
            containers: docker.containerSize,
            volumes: docker.volumeSize,
            buildCache: docker.buildCacheSize,
            total: docker.totalDiskUsage,
            reclaimable: docker.reclaimableSize,
          }
        : null,
    };
  }

  async containers(
    orgId: string,
    serverId: string,
  ): Promise<ServerContainerList> {
    await this.assertServerInOrg(orgId, serverId);
    const rows = await this.prisma.client.serverContainer.findMany({
      where: { serverId },
      // running first, then by name
      orderBy: [{ state: 'desc' }, { containerName: 'asc' }],
    });
    const collectedAt = rows.reduce<Date | null>(
      (max, r) => (!max || r.updatedAt > max ? r.updatedAt : max),
      null,
    );
    return {
      collectedAt: collectedAt?.toISOString() ?? null,
      items: rows.map((r) => ({
        id: r.id,
        dockerId: r.dockerId.slice(0, 12),
        name: r.containerName,
        image: r.image,
        state: r.state,
        health: r.health as z.infer<typeof ContainerHealthSchema> | null,
        statusText: r.statusText,
        cpu: r.containerCpuUsage,
        memoryBytes: r.containerMemoryUsage,
        memoryLimitBytes: r.containerMemoryLimit,
      })),
    };
  }

  /**
   * For the server cards: each server's latest reading and container counts,
   * in two queries however many servers there are. DISTINCT ON picks the
   * newest row per server using the (serverId, createdAt) index.
   */
  async cardsFor(serverIds: string[]): Promise<
    Map<
      string,
      {
        usage: ServerUsage | null;
        containers: { total: number; running: number };
      }
    >
  > {
    const out = new Map<
      string,
      {
        usage: ServerUsage | null;
        containers: { total: number; running: number };
      }
    >();
    for (const id of serverIds)
      out.set(id, { usage: null, containers: { total: 0, running: 0 } });
    if (!serverIds.length) return out;

    const [latest, counts] = await Promise.all([
      this.prisma.client.$queryRaw<
        Array<{
          serverId: string;
          cpuUsage: number;
          memoryUsage: number;
          diskUsage: number;
          createdAt: Date;
        }>
      >`
        SELECT DISTINCT ON ("serverId") "serverId", "cpuUsage", "memoryUsage", "diskUsage", "createdAt"
        FROM "ServerMetrics"
        WHERE "serverId" IN (${Prisma.join(serverIds)})
        ORDER BY "serverId", "createdAt" DESC`,
      this.prisma.client.serverContainer.groupBy({
        by: ['serverId', 'state'],
        where: { serverId: { in: serverIds } },
        _count: { _all: true },
      }),
    ]);
    for (const m of latest) {
      out.get(m.serverId)!.usage = {
        cpu: round(m.cpuUsage),
        memory: round(m.memoryUsage),
        disk: round(m.diskUsage),
        at: new Date(m.createdAt).toISOString(),
      };
    }
    for (const c of counts) {
      const card = out.get(c.serverId)!;
      card.containers.total += c._count._all;
      if (c.state === 'running') card.containers.running += c._count._all;
    }
    return out;
  }

  private async assertServerInOrg(orgId: string, serverId: string) {
    const found = await this.prisma.client.server.findFirst({
      where: { id: serverId, organizationId: orgId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException(SERVER_MESSAGES.not_found);
  }
}
