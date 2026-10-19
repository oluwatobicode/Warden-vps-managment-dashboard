import { Injectable } from '@nestjs/common';
import type { Dashboard, RecentDeployment } from 'shared-types';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * The Home page in one call. Every number is a COUNT in Postgres, run in
 * parallel; nothing loads a whole list just to measure it. All scoped to the
 * session's org.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(orgId: string): Promise<Dashboard> {
    const db = this.prisma.client;
    const org = { organizationId: orgId };
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    const [
      projects,
      projectsNeedingAttention,
      environments,
      services,
      deploys,
      deploysLast7Days,
      servers,
      recent,
    ] = await Promise.all([
      db.project.count({ where: org }),
      // Worst-status-wins: one degraded or failed service puts the project in
      // trouble, which is exactly "has such a service somewhere".
      db.project.count({
        where: {
          ...org,
          environments: {
            some: { services: { some: { status: { in: ['DEGRADED', 'FAILED'] } } } },
          },
        },
      }),
      db.environment.count({ where: org }),
      db.service.count({ where: org }),
      db.deployment.count({ where: org }),
      db.deployment.count({ where: { ...org, createdAt: { gte: weekAgo } } }),
      db.server.groupBy({ by: ['status'], where: org, _count: { _all: true } }),
      db.deployment.findMany({
        where: org,
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          service: {
            select: {
              serviceName: true,
              environment: {
                select: {
                  environmentName: true,
                  project: { select: { id: true, projectName: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    const serversBy = (s: string) =>
      servers.find((g) => g.status === s)?._count._all ?? 0;

    return {
      counts: {
        projects,
        projectsNeedingAttention,
        environments,
        services,
        deploys,
        deploysLast7Days,
        serversTotal: servers.reduce((n, g) => n + g._count._all, 0),
        serversConnected: serversBy('CONNECTED'),
        serversOffline: serversBy('OFFLINE'),
      },
      recentDeployments: recent.map(
        (d): RecentDeployment => ({
          id: d.id,
          number: d.number,
          status: d.deploymentStatus,
          serviceId: d.serviceId,
          serviceName: d.service.serviceName,
          projectId: d.service.environment.project.id,
          projectName: d.service.environment.project.projectName,
          environmentName: d.service.environment.environmentName,
          branch: d.branch,
          commitSha: d.commitSha,
          commitMessage: d.commitMessage,
          triggeredByName: d.triggeredByName,
          createdAt: d.createdAt.toISOString(),
          finishedAt: d.finishedAt?.toISOString() ?? null,
        }),
      ),
    };
  }
}
