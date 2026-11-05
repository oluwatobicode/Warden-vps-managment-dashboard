import { BadRequestException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Prisma } from 'db';
import {
  FUNNEL_STEPS,
  PLATFORM_LIMITS,
  PLATFORM_ORGS_PAGE,
  QUEUES,
  type DayCount,
  type FunnelStep,
  type PlatformHealth,
  type PlatformOrgPage,
  type PlatformOrgRow,
  type PlatformOrgSort,
  type PlatformOverview,
} from 'shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

const DAY_MS = 24 * 3600 * 1000;
const CHART_DAYS = 30;
const TOP_PROVIDERS = 10;
/** The tables that grow without bound between prunes. */
const BIG_TABLES = ['ServiceLog', 'ServerLog', 'ServerMetrics', 'DeploymentLog', 'DockerDiskMetrics'];
/** Deploy statuses that count toward the success rate (CANCELLED is someone's choice, not a failure). */
const RATED = ['SUCCESS', 'FAILED', 'GATE_FAILED', 'ROLLED_BACK'] as const;
/** Snapshot prefix of triggeredByName for API-token deploys (deploy.service.ts). */
const TOKEN_PREFIX = 'token: ';
/** Empty Membership.lastActiveAt sorts last under "last active". */
const NEVER = new Date(0);

/**
 * The platform owner's view across EVERY organization. This is the one module
 * allowed to query without an organizationId filter, on purpose; keep it that
 * way only here. Counts and metadata only: nothing that names a person (no
 * emails), points at infra (no IPs, repo URLs) or reveals data (variables,
 * logs, secrets). Every number is computed by Postgres, in parallel.
 */
@Injectable()
export class PlatformService implements OnModuleDestroy {
  /** Read-only handles (job counts only) on every worker queue. Never add a job through these. */
  private readonly queues: Queue[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    this.queues = Object.values(QUEUES).map((name) => new Queue(name, { connection: redis }));
  }

  async onModuleDestroy(): Promise<void> {
    // The connection is the shared RedisService; BullMQ leaves a passed-in client open.
    await Promise.all(this.queues.map((q) => q.close()));
  }

  // ── overview ──────────────────────────────────────────────

  async overview(): Promise<PlatformOverview> {
    const db = this.prisma.client;
    const now = Date.now();
    const d1 = new Date(now - DAY_MS);
    const d7 = new Date(now - 7 * DAY_MS);
    const d30 = new Date(now - 30 * DAY_MS);
    const chartFrom = startOfUtcDay(now - (CHART_DAYS - 1) * DAY_MS);
    const recent = { createdAt: { gte: d30 } };

    const [
      users,
      users7d,
      users30d,
      byProvider,
      orgs,
      orgs7d,
      orgs30d,
      active,
      teamSize,
      dormant,
      tombTotal,
      tomb30d,
      tombDeployed,
      invitations,
      signupDays,
      funnel,
      medianToSuccess,
      deploys,
      deploys7d,
      deploys30d,
      deployDays,
      byStatus,
      durations,
      byBuild,
      byType,
      rollbacks,
      byToken,
      serversByStatus,
      offline24h,
      providers,
      proxyInstalled,
      servicesByType,
      servicesByStatus,
      databases,
      backups,
      backupBytes,
      ownStorage,
      installations,
      domains,
      tokens,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { createdAt: { gte: d7 } } }),
      db.user.count({ where: { createdAt: { gte: d30 } } }),
      db.user.groupBy({ by: ['authProcess'], _count: { _all: true } }),
      db.organization.count(),
      db.organization.count({ where: { createdAt: { gte: d7 } } }),
      db.organization.count({ where: { createdAt: { gte: d30 } } }),
      db.$queryRaw<Array<{ d1: number; d7: number; d30: number; since: Date | null }>>`
        SELECT count(DISTINCT "userId") FILTER (WHERE "lastActiveAt" >= ${d1})::int AS d1,
               count(DISTINCT "userId") FILTER (WHERE "lastActiveAt" >= ${d7})::int AS d7,
               count(DISTINCT "userId") FILTER (WHERE "lastActiveAt" >= ${d30})::int AS d30,
               min("lastActiveAt") AS since
        FROM "Membership"`,
      db.$queryRaw<Array<{ solo: number; team: number }>>`
        SELECT count(*) FILTER (WHERE n = 1)::int AS solo,
               count(*) FILTER (WHERE n >= 2)::int AS team
        FROM (SELECT count(*) AS n FROM "Membership" WHERE status = 'ACTIVE' GROUP BY "organizationId") t`,
      db.organization.count({
        where: {
          memberships: { none: { status: 'ACTIVE', lastActiveAt: { gte: d30 } } },
          deployments: { none: { createdAt: { gte: d30 } } },
        },
      }),
      db.organizationTombstone.count(),
      db.organizationTombstone.count({ where: { deletedAt: { gte: d30 } } }),
      db.organizationTombstone.count({ where: { everDeployedOk: true } }),
      db.invitation.groupBy({
        by: ['status'],
        where: { status: { in: ['PENDING', 'ACCEPTED'] } },
        _count: { _all: true },
      }),
      this.perDay('User', chartFrom),
      this.funnel(),
      db.$queryRaw<Array<{ median: number | null }>>`
        SELECT percentile_cont(0.5) WITHIN GROUP (
                 ORDER BY extract(epoch FROM f.first_ok - o."createdAt"))::float AS median
        FROM (SELECT "organizationId", min("finishedAt") AS first_ok
              FROM "Deployment"
              WHERE "deploymentStatus" = 'SUCCESS' AND "finishedAt" IS NOT NULL
              GROUP BY 1) f
        JOIN "Organization" o ON o.id = f."organizationId"`,
      db.deployment.count(),
      db.deployment.count({ where: { createdAt: { gte: d7 } } }),
      db.deployment.count({ where: recent }),
      this.perDay('Deployment', chartFrom),
      db.deployment.groupBy({ by: ['deploymentStatus'], where: recent, _count: { _all: true } }),
      db.$queryRaw<Array<{ p50: number | null; p95: number | null }>>`
        SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY s)::float AS p50,
               percentile_cont(0.95) WITHIN GROUP (ORDER BY s)::float AS p95
        FROM (SELECT extract(epoch FROM "finishedAt" - "startedAt") AS s
              FROM "Deployment"
              WHERE "createdAt" >= ${d30} AND "startedAt" IS NOT NULL AND "finishedAt" IS NOT NULL) t`,
      db.deployment.groupBy({
        by: ['buildMethod'],
        where: { ...recent, buildMethod: { not: null } },
        _count: { _all: true },
      }),
      db.deployment.groupBy({ by: ['deploymentType'], where: recent, _count: { _all: true } }),
      db.deployment.count({ where: { ...recent, rollbackOfId: { not: null } } }),
      db.deployment.count({ where: { ...recent, triggeredByName: { startsWith: TOKEN_PREFIX } } }),
      db.server.groupBy({ by: ['status'], _count: { _all: true } }),
      db.server.count({
        where: {
          status: 'OFFLINE',
          OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: d1 } }],
        },
      }),
      db.$queryRaw<Array<{ provider: string | null; count: number }>>`
        SELECT nullif(lower(trim(provider)), '') AS provider, count(*)::int AS count
        FROM "Server" GROUP BY 1 ORDER BY 2 DESC, 1`,
      db.server.count({ where: { proxyInstalledAt: { not: null } } }),
      db.service.groupBy({ by: ['type'], _count: { _all: true } }),
      db.service.groupBy({ by: ['status'], _count: { _all: true } }),
      db.serviceDatabase.groupBy({
        by: ['engine', 'version'],
        _count: { _all: true },
        orderBy: [{ engine: 'asc' }, { version: 'desc' }],
      }),
      db.databaseBackup.groupBy({
        by: ['status'],
        where: { ...recent, status: { in: ['SUCCESS', 'FAILED'] } },
        _count: { _all: true },
      }),
      db.databaseBackup.groupBy({ by: ['storage'], where: { status: 'SUCCESS' }, _sum: { sizeBytes: true } }),
      db.backupStorage.count(),
      db.githubInstallation.count(),
      db.serviceDomain.count(),
      db.apiToken.groupBy({ by: ['apiTokenScope'], _count: { _all: true } }),
    ]);

    const statusCounts = tally(
      ['QUEUED', 'BUILDING', 'DEPLOYING', 'HEALTH_CHECK', 'SUCCESS', 'GATE_FAILED', 'ROLLED_BACK', 'FAILED', 'CANCELLED'] as const,
      byStatus.map((r) => [r.deploymentStatus, r._count._all] as const),
    );
    const rated = RATED.reduce((n, s) => n + statusCounts[s], 0);
    const serverCounts = tally(
      ['CONNECTED', 'IDLE', 'OFFLINE'] as const,
      serversByStatus.map((r) => [r.status, r._count._all] as const),
    );
    const serverTotal = serverCounts.CONNECTED + serverCounts.IDLE + serverCounts.OFFLINE;
    const backupCounts = tally(['SUCCESS', 'FAILED'] as const, backups.map((r) => [r.status, r._count._all] as const));
    const inviteCounts = tally(['PENDING', 'ACCEPTED'] as const, invitations.map((r) => [r.status, r._count._all] as const));
    const tokenScopes = tally(['READ', 'DEPLOY', 'ADMIN'] as const, tokens.map((r) => [r.apiTokenScope, r._count._all] as const));
    const bytesOf = (kind: 'PLATFORM' | 'ORG') => backupBytes.find((b) => b.storage === kind)?._sum.sizeBytes ?? 0;

    return {
      growth: {
        users: { total: users, new7d: users7d, new30d: users30d },
        signupsByProvider: tally(['EMAIL', 'GITHUB', 'GOOGLE'] as const, byProvider.map((r) => [r.authProcess, r._count._all] as const)),
        orgs: { total: orgs, new7d: orgs7d, new30d: orgs30d },
        activeUsers: { d1: active[0].d1, d7: active[0].d7, d30: active[0].d30 },
        teamSize: { solo: teamSize[0].solo, team: teamSize[0].team },
        dormantOrgs: dormant,
        activityTrackedSince: active[0].since?.toISOString() ?? null,
        deletedOrgs: { last30d: tomb30d, total: tombTotal, everDeployedOk: tombDeployed },
        invitations: { pending: inviteCounts.PENDING, accepted: inviteCounts.ACCEPTED },
        signupsPerDay: signupDays,
      },
      funnel: {
        steps: funnel,
        medianSecondsToFirstSuccess: medianToSuccess[0]?.median ?? null,
      },
      deploys: {
        total: deploys,
        last7d: deploys7d,
        last30d: deploys30d,
        perDay: deployDays,
        byStatus: statusCounts,
        successRate: rated ? statusCounts.SUCCESS / rated : null,
        durationSeconds: { p50: durations[0]?.p50 ?? null, p95: durations[0]?.p95 ?? null },
        byBuildMethod: tally(['DOCKERFILE', 'RAILPACK'] as const, byBuild.map((r) => [r.buildMethod, r._count._all] as const)),
        byType: tally(['MANUAL', 'AUTOMATED'] as const, byType.map((r) => [r.deploymentType, r._count._all] as const)),
        rollbacks,
        byApiToken: byToken,
      },
      infra: {
        serversByStatus: serverCounts,
        serversOfflineOver24h: offline24h,
        serversByProvider: topProviders(providers),
        proxy: { installed: proxyInstalled, notInstalled: serverTotal - proxyInstalled },
        servicesByType: tally(
          ['APPLICATION', 'WORKER', 'DATABASE', 'COMPOSE'] as const,
          servicesByType.map((r) => [r.type, r._count._all] as const),
        ),
        servicesByStatus: tally(
          ['NOT_DEPLOYED', 'DEPLOYING', 'HEALTHY', 'DEGRADED', 'FAILED', 'STOPPED'] as const,
          servicesByStatus.map((r) => [r.status, r._count._all] as const),
        ),
        databases: databases.map((d) => ({ engine: d.engine, version: d.version, count: d._count._all })),
        backups30d: { success: backupCounts.SUCCESS, failed: backupCounts.FAILED },
        backupBytes: { platform: bytesOf('PLATFORM'), org: bytesOf('ORG') },
        orgsWithOwnStorage: ownStorage,
        githubInstallations: installations,
        customDomains: domains,
        apiTokens: {
          total: tokenScopes.READ + tokenScopes.DEPLOY + tokenScopes.ADMIN,
          byScope: tokenScopes,
        },
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /** Orgs that reached each activation step, in FUNNEL_STEPS order. */
  private async funnel(): Promise<Array<{ step: FunnelStep; orgs: number }>> {
    const org = this.prisma.client.organization;
    const where: Record<FunnelStep, Prisma.OrganizationWhereInput> = {
      orgCreated: {},
      sshKey: { sshKeys: { some: {} } },
      server: { servers: { some: {} } },
      serverReachable: { servers: { some: { lastSeenAt: { not: null } } } },
      project: { projects: { some: {} } },
      deployment: { deployments: { some: {} } },
      successDeploy: { deployments: { some: { deploymentStatus: 'SUCCESS' } } },
    };
    const counts = await Promise.all(FUNNEL_STEPS.map((s) => org.count({ where: where[s] })));
    return FUNNEL_STEPS.map((step, i) => ({ step, orgs: counts[i] }));
  }

  /** Rows per UTC day since `from`, every day present (0 when none). Table names are constants, never input. */
  private async perDay(table: 'User' | 'Deployment', from: Date): Promise<DayCount[]> {
    const rows = await this.prisma.client.$queryRaw<Array<{ day: Date; count: number }>>`
      SELECT date_trunc('day', "createdAt") AS day, count(*)::int AS count
      FROM ${Prisma.raw(`"${table}"`)}
      WHERE "createdAt" >= ${from}
      GROUP BY 1`;
    const byDay = new Map(rows.map((r) => [r.day.toISOString().slice(0, 10), r.count]));
    return Array.from({ length: CHART_DAYS }, (_, i) => {
      const day = new Date(from.getTime() + i * DAY_MS).toISOString().slice(0, 10);
      return { day, count: byDay.get(day) ?? 0 };
    });
  }

  // ── per-org table ─────────────────────────────────────────

  /**
   * One page of orgs. A raw query picks the page's ids in the chosen order
   * (keyset on (sort value, id), newest/highest first), then a handful of
   * grouped queries fill in that page's numbers: no N+1.
   */
  async orgs(sort: PlatformOrgSort, cursor?: string): Promise<PlatformOrgPage> {
    const db = this.prisma.client;
    const d30 = new Date(Date.now() - 30 * DAY_MS);
    const after = cursor ? decodeCursor(sort, cursor) : null;

    const key = {
      created: Prisma.sql`o."createdAt"`,
      lastActive: Prisma.sql`coalesce((SELECT max(m."lastActiveAt") FROM "Membership" m WHERE m."organizationId" = o.id), ${NEVER})`,
      deploys30d: Prisma.sql`(SELECT count(*)::int FROM "Deployment" d WHERE d."organizationId" = o.id AND d."createdAt" >= ${d30})`,
    }[sort];

    const page = await db.$queryRaw<Array<{ id: string; k: Date | number }>>`
      SELECT id, k FROM (SELECT o.id, ${key} AS k FROM "Organization" o) t
      ${after ? Prisma.sql`WHERE (k, id) < (${after.k}, ${after.id})` : Prisma.empty}
      ORDER BY k DESC, id DESC
      LIMIT ${PLATFORM_ORGS_PAGE + 1}`;

    const hasMore = page.length > PLATFORM_ORGS_PAGE;
    const rows = page.slice(0, PLATFORM_ORGS_PAGE);
    const ids = rows.map((r) => r.id);
    if (!ids.length) return { items: [], nextCursor: null };
    const inPage = { organizationId: { in: ids } };

    const [orgs, members, lastActive, services, offline, deploys30d, lastDeploy, succeeded] = await Promise.all([
      db.organization.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          organizationName: true,
          slug: true,
          createdAt: true,
          backupStorage: { select: { id: true } },
          _count: { select: { servers: true, projects: true } },
        },
      }),
      db.membership.groupBy({ by: ['organizationId'], where: { ...inPage, status: 'ACTIVE' }, _count: { _all: true } }),
      db.membership.groupBy({ by: ['organizationId'], where: inPage, _max: { lastActiveAt: true } }),
      db.service.groupBy({ by: ['organizationId'], where: inPage, _count: { _all: true } }),
      db.server.groupBy({ by: ['organizationId'], where: { ...inPage, status: 'OFFLINE' }, _count: { _all: true } }),
      db.deployment.groupBy({ by: ['organizationId'], where: { ...inPage, createdAt: { gte: d30 } }, _count: { _all: true } }),
      db.deployment.groupBy({ by: ['organizationId'], where: inPage, _max: { createdAt: true } }),
      db.deployment.groupBy({ by: ['organizationId'], where: { ...inPage, deploymentStatus: 'SUCCESS' }, _count: { _all: true } }),
    ]);

    const byOrg = <T extends { organizationId: string }>(list: T[]) => new Map(list.map((r) => [r.organizationId, r]));
    const m = byOrg(members), la = byOrg(lastActive), sv = byOrg(services), off = byOrg(offline);
    const d = byOrg(deploys30d), ld = byOrg(lastDeploy), ok = byOrg(succeeded);
    const orgById = new Map(orgs.map((o) => [o.id, o]));

    const items = ids.flatMap((id): PlatformOrgRow[] => {
      const o = orgById.get(id);
      if (!o) return []; // deleted between the two queries
      return [
        {
          id,
          name: o.organizationName,
          slug: o.slug,
          createdAt: o.createdAt.toISOString(),
          members: m.get(id)?._count._all ?? 0,
          lastActiveAt: la.get(id)?._max.lastActiveAt?.toISOString() ?? null,
          servers: o._count.servers,
          serversOffline: off.get(id)?._count._all ?? 0,
          projects: o._count.projects,
          services: sv.get(id)?._count._all ?? 0,
          deploys30d: d.get(id)?._count._all ?? 0,
          lastDeployAt: ld.get(id)?._max.createdAt?.toISOString() ?? null,
          everDeployedOk: (ok.get(id)?._count._all ?? 0) > 0,
          backupStorage: o.backupStorage ? 'own' : 'platform',
        },
      ];
    });

    const last = rows[rows.length - 1];
    return { items, nextCursor: hasMore ? encodeCursor(last.k, last.id) : null };
  }

  // ── Warden's own health ───────────────────────────────────

  async health(): Promise<PlatformHealth> {
    const db = this.prisma.client;
    const [size, tables, queues, servers, newest, leases, memory] = await Promise.all([
      db.$queryRaw<Array<{ bytes: number }>>`SELECT pg_database_size(current_database())::float8 AS bytes`,
      // Size + the planner's row estimate: never count(*) on these, they're the huge ones.
      db.$queryRaw<Array<{ name: string; bytes: number; rows: number }>>`
        SELECT c.relname AS name, pg_total_relation_size(c.oid)::float8 AS bytes, c.reltuples::float8 AS rows
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = current_schema() AND c.relkind = 'r' AND c.relname IN (${Prisma.join(BIG_TABLES)})`,
      Promise.all(
        this.queues.map(async (q) => {
          const c = await q.getJobCounts('waiting', 'active', 'failed', 'delayed');
          return { name: q.name, waiting: c.waiting ?? 0, active: c.active ?? 0, failed: c.failed ?? 0, delayed: c.delayed ?? 0 };
        }),
      ),
      db.server.count(),
      db.serverMetrics.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      this.countKeys('logs:lease:*'),
      this.redis.info('memory'),
    ]);

    const lastMetricsAt = newest?.createdAt ?? null;
    const silent = !lastMetricsAt || Date.now() - lastMetricsAt.getTime() > PLATFORM_LIMITS.workerSilentMs;
    const used = Number(memory.match(/^used_memory:(\d+)/m)?.[1] ?? 0);
    const max = Number(memory.match(/^maxmemory:(\d+)/m)?.[1] ?? 0);

    return {
      postgres: {
        sizeBytes: size[0].bytes,
        tables: BIG_TABLES.map((name) => {
          const t = tables.find((r) => r.name === name);
          return { name, sizeBytes: t?.bytes ?? 0, approxRows: t && t.rows >= 0 ? Math.round(t.rows) : null };
        }),
      },
      queues,
      worker: {
        servers,
        lastMetricsAt: lastMetricsAt?.toISOString() ?? null,
        state: servers === 0 ? 'no-servers' : silent ? 'silent' : 'ok',
      },
      logCollector: { leases, servers },
      redis: { usedMemoryBytes: used, maxMemoryBytes: max > 0 ? max : null },
      generatedAt: new Date().toISOString(),
    };
  }

  /** SCAN, never KEYS: KEYS blocks Redis while it walks every key. */
  private async countKeys(match: string): Promise<number> {
    let cursor = '0';
    let n = 0;
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', match, 'COUNT', 500);
      cursor = next;
      n += keys.length;
    } while (cursor !== '0');
    return n;
  }
}

/** Every key present (0 when no row), from [value, count] pairs of a groupBy. */
function tally<K extends string>(keys: readonly K[], pairs: Array<readonly [string | null, number]>): Record<K, number> {
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  for (const [k, n] of pairs) if (k !== null && k in out) out[k as K] += n;
  return out;
}

function startOfUtcDay(ms: number): Date {
  const d = new Date(ms);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Top 10 providers by servers, the rest folded into "other". */
function topProviders(rows: Array<{ provider: string | null; count: number }>) {
  const named = new Map<string, number>();
  for (const r of rows) {
    const p = r.provider ?? 'unknown';
    named.set(p, (named.get(p) ?? 0) + r.count);
  }
  const sorted = [...named].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, TOP_PROVIDERS).map(([provider, count]) => ({ provider, count }));
  const rest = sorted.slice(TOP_PROVIDERS).reduce((n, [, c]) => n + c, 0);
  return rest ? [...top, { provider: 'other', count: rest }] : top;
}

/** The cursor is the last row's sort value + id, base64url JSON. Opaque to the browser. */
function encodeCursor(k: Date | number, id: string): string {
  const v = k instanceof Date ? k.toISOString() : k;
  return Buffer.from(JSON.stringify([v, id])).toString('base64url');
}

function decodeCursor(sort: PlatformOrgSort, cursor: string): { k: Date | number; id: string } {
  try {
    const [v, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString()) as [unknown, unknown];
    if (typeof id !== 'string') throw new Error();
    if (sort === 'deploys30d') {
      if (typeof v !== 'number' || !Number.isInteger(v)) throw new Error();
      return { k: v, id };
    }
    const k = new Date(typeof v === 'string' ? v : NaN);
    if (Number.isNaN(k.getTime())) throw new Error();
    return { k, id };
  } catch {
    throw new BadRequestException('Invalid cursor');
  }
}
