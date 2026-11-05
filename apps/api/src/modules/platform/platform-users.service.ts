import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'db';
import {
  PLATFORM_DEPLOYS_PAGE,
  PLATFORM_USER_RECENT_DEPLOYS,
  PLATFORM_USERS_PAGE,
  type FailedStep,
  type PlatformDeployFilter,
  type PlatformDeployPage,
  type PlatformDeployRow,
  type PlatformUserDetail,
  type PlatformUserEmail,
  type PlatformUserPage,
  type PlatformUserRow,
  type PlatformUsersQuery,
} from 'shared-types';
import { PrismaService } from '../../prisma/prisma.service';

const FAILED = ['FAILED', 'GATE_FAILED'] as const;
/** Same as the overview's success rate: CANCELLED is someone's choice, not a failure. */
const RATED = ['SUCCESS', 'FAILED', 'GATE_FAILED', 'ROLLED_BACK'] as const;
/** Empty Membership.lastActiveAt sorts last under "last active". */
const NEVER = new Date(0);
/** PlatformAccessLog.action for the email reveal. */
const EMAIL_REVEALED = 'user.email_revealed';

/** What a deploy row reads: names and timings, never commit, branch, logs or history messages. */
const DEPLOY_SELECT = {
  id: true,
  number: true,
  deploymentStatus: true,
  triggeredByName: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  service: { select: { serviceName: true } },
  organization: { select: { organizationName: true } },
} satisfies Prisma.DeploymentSelect;

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  authProcess: true,
  createdAt: true,
  memberships: {
    select: { status: true, createdAt: true, organization: { select: { id: true, organizationName: true } } },
  },
} satisfies Prisma.UserSelect;

/**
 * The platform owner's people and deploys pages, across every org (owner only,
 * see PlatformOwnerGuard). Names and per-user deploy counts are shown (the
 * owner relaxed "counts only" for these on 2026-11-05); an email only through
 * revealEmail, which logs every call.
 */
@Injectable()
export class PlatformUsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ── users list ────────────────────────────────────────────

  /** One page of users: a raw query picks the ids in order (keyset on (sort value, id)), grouped queries fill in the numbers. */
  async users({ sort, q, cursor }: PlatformUsersQuery): Promise<PlatformUserPage> {
    const db = this.prisma.client;
    const isCount = sort === 'deploys' || sort === 'failed';
    const after = cursor ? decodeCursor(cursor, isCount ? 'int' : 'date') : null;

    const key = {
      joined: Prisma.sql`u."createdAt"`,
      lastActive: Prisma.sql`coalesce((SELECT max(m."lastActiveAt") FROM "Membership" m WHERE m."userId" = u.id), ${NEVER})`,
      deploys: Prisma.sql`(SELECT count(*)::int FROM "Deployment" d WHERE d."triggeredById" = u.id)`,
      failed: Prisma.sql`(SELECT count(*)::int FROM "Deployment" d WHERE d."triggeredById" = u.id AND d."deploymentStatus" IN ('FAILED', 'GATE_FAILED'))`,
    }[sort];
    // LIKE wildcards in the search are escaped, the same as modules/logs.
    const search = q
      ? Prisma.sql`WHERE (u."firstName" || ' ' || u."lastName") ILIKE ${`%${q.replace(/[\\%_]/g, '\\$&')}%`}`
      : Prisma.empty;

    const page = await db.$queryRaw<Array<{ id: string; k: Date | number }>>`
      SELECT id, k FROM (SELECT u.id, ${key} AS k FROM "User" u ${search}) t
      ${after ? Prisma.sql`WHERE (k, id) < (${after.k}, ${after.id})` : Prisma.empty}
      ORDER BY k DESC, id DESC
      LIMIT ${PLATFORM_USERS_PAGE + 1}`;

    const hasMore = page.length > PLATFORM_USERS_PAGE;
    const rows = page.slice(0, PLATFORM_USERS_PAGE);
    const ids = rows.map((r) => r.id);
    if (!ids.length) return { items: [], nextCursor: null };
    const byUser = { triggeredById: { in: ids } };

    const [users, lastActive, deploys, failed] = await Promise.all([
      db.user.findMany({ where: { id: { in: ids } }, select: USER_SELECT }),
      db.membership.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _max: { lastActiveAt: true } }),
      db.deployment.groupBy({ by: ['triggeredById'], where: byUser, _count: { _all: true } }),
      db.deployment.groupBy({
        by: ['triggeredById'],
        where: { ...byUser, deploymentStatus: { in: [...FAILED] } },
        _count: { _all: true },
      }),
    ]);

    const userById = new Map(users.map((u) => [u.id, u]));
    const la = new Map(lastActive.map((r) => [r.userId, r._max.lastActiveAt]));
    const dep = new Map(deploys.map((r) => [r.triggeredById, r._count._all]));
    const fail = new Map(failed.map((r) => [r.triggeredById, r._count._all]));

    const items = ids.flatMap((id): PlatformUserRow[] => {
      const u = userById.get(id);
      if (!u) return []; // deleted between the two queries
      return [
        {
          ...userHeader(u),
          lastActiveAt: la.get(id)?.toISOString() ?? null,
          deploys: dep.get(id) ?? 0,
          failedDeploys: fail.get(id) ?? 0,
        },
      ];
    });

    const last = rows[rows.length - 1];
    return { items, nextCursor: hasMore ? encodeCursor(last.k, last.id) : null };
  }

  // ── one user ──────────────────────────────────────────────

  async user(id: string): Promise<PlatformUserDetail> {
    const db = this.prisma.client;
    const u = await db.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!u) throw new NotFoundException('User not found');

    const [byStatus, lastActive, recent] = await Promise.all([
      db.deployment.groupBy({ by: ['deploymentStatus'], where: { triggeredById: id }, _count: { _all: true } }),
      db.membership.aggregate({ where: { userId: id }, _max: { lastActiveAt: true } }),
      this.deployRows({ triggeredById: id }, PLATFORM_USER_RECENT_DEPLOYS),
    ]);

    const n = (s: string) => byStatus.find((r) => r.deploymentStatus === s)?._count._all ?? 0;
    const rated = RATED.reduce((sum, s) => sum + n(s), 0);
    return {
      ...userHeader(u),
      lastActiveAt: lastActive._max.lastActiveAt?.toISOString() ?? null,
      deploys: {
        total: byStatus.reduce((sum, r) => sum + r._count._all, 0),
        succeeded: n('SUCCESS'),
        failed: n('FAILED') + n('GATE_FAILED'),
        successRate: rated ? n('SUCCESS') / rated : null,
      },
      recentDeploys: recent.rows,
    };
  }

  /**
   * The ONE place /platform returns an email. The access-log row is written
   * before the email goes out: if logging fails, nothing is revealed.
   */
  async revealEmail(actorUserId: string, id: string): Promise<PlatformUserEmail> {
    const db = this.prisma.client;
    const u = await db.user.findUnique({ where: { id }, select: { email: true } });
    if (!u) throw new NotFoundException('User not found');
    await db.platformAccessLog.create({ data: { actorUserId, action: EMAIL_REVEALED, targetUserId: id } });
    return { email: u.email };
  }

  // ── deploys across every org ──────────────────────────────

  /** Newest first, keyset on (createdAt, id). */
  async deploys(status: PlatformDeployFilter, cursor?: string): Promise<PlatformDeployPage> {
    const after = cursor ? (decodeCursor(cursor, 'date') as { k: Date; id: string }) : null;
    const where: Prisma.DeploymentWhereInput = {
      ...(status === 'failed' && { deploymentStatus: { in: [...FAILED] } }),
      ...(status === 'succeeded' && { deploymentStatus: 'SUCCESS' }),
      ...(after && { OR: [{ createdAt: { lt: after.k } }, { createdAt: after.k, id: { lt: after.id } }] }),
    };
    const { rows, hasMore } = await this.deployRows(where, PLATFORM_DEPLOYS_PAGE);
    const last = rows[rows.length - 1];
    return { items: rows, nextCursor: hasMore && last ? encodeCursor(new Date(last.createdAt), last.id) : null };
  }

  /** Up to `take` deploys, newest first, plus the failed ones' step from ONE history query. */
  private async deployRows(where: Prisma.DeploymentWhereInput, take: number) {
    const found = await this.prisma.client.deployment.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      select: DEPLOY_SELECT,
    });
    const hasMore = found.length > take;
    const page = found.slice(0, take);
    const steps = await this.failedSteps(
      page.filter((d) => d.deploymentStatus === 'FAILED').map((d) => d.id),
    );

    const rows = page.map(
      (d): PlatformDeployRow => ({
        id: d.id,
        number: d.number,
        serviceName: d.service.serviceName,
        orgName: d.organization.organizationName,
        triggeredByName: d.triggeredByName,
        status: d.deploymentStatus,
        durationSeconds:
          d.startedAt && d.finishedAt ? Math.max(0, (d.finishedAt.getTime() - d.startedAt.getTime()) / 1000) : null,
        createdAt: d.createdAt.toISOString(),
        // GATE_FAILED is the health check by definition; FAILED is wherever its history last stood.
        failedStep:
          d.deploymentStatus === 'GATE_FAILED'
            ? 'HEALTH_CHECK'
            : d.deploymentStatus === 'FAILED'
              ? (steps.get(d.id) ?? null)
              : null,
      }),
    );
    return { rows, hasMore };
  }

  /**
   * deploymentId → the last pipeline step its history reached, for every id in
   * one DISTINCT ON query. Only the status column is read: history messages
   * hold error text and never leave this function.
   */
  private async failedSteps(ids: string[]): Promise<Map<string, FailedStep>> {
    if (!ids.length) return new Map();
    const rows = await this.prisma.client.$queryRaw<Array<{ id: string; step: FailedStep }>>`
      SELECT DISTINCT ON ("deploymentId") "deploymentId" AS id, status::text AS step
      FROM "DeploymentHistory"
      WHERE "deploymentId" IN (${Prisma.join(ids)})
        AND status IN ('QUEUED', 'BUILDING', 'DEPLOYING', 'HEALTH_CHECK')
      ORDER BY "deploymentId", "createdAt" DESC`;
    return new Map(rows.map((r) => [r.id, r.step]));
  }
}

type UserWithMemberships = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

/** Name, org and sign-up facts shared by the list and the user page. */
function userHeader(u: UserWithMemberships) {
  // Phase 1 is one org per user: the ACTIVE membership, else the newest (suspended / pending).
  const m =
    u.memberships.find((x) => x.status === 'ACTIVE') ??
    [...u.memberships].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  return {
    id: u.id,
    name: `${u.firstName} ${u.lastName}`.trim(),
    org: m ? { id: m.organization.id, name: m.organization.organizationName } : null,
    authProcess: u.authProcess,
    createdAt: u.createdAt.toISOString(),
  };
}

/** The last row's sort value + id, base64url JSON. Opaque to the browser. */
function encodeCursor(k: Date | number, id: string): string {
  return Buffer.from(JSON.stringify([k instanceof Date ? k.toISOString() : k, id])).toString('base64url');
}

function decodeCursor(cursor: string, kind: 'date' | 'int'): { k: Date | number; id: string } {
  try {
    const [v, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString()) as [unknown, unknown];
    if (typeof id !== 'string') throw new Error();
    if (kind === 'int') {
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
