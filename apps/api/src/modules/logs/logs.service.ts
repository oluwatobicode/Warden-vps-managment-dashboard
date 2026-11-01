import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from 'db';
import { LOG_SOCKET, type ListLogsQuery, type LogContext, type LogLine, type LogPage } from 'shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { LOG_MESSAGES } from '../../common/constants/messages.config';

const LINE = { id: true, serviceId: true, deploymentId: true, stream: true, ts: true, message: true } satisfies Prisma.ServiceLogSelect;
type Row = Prisma.ServiceLogGetPayload<{ select: typeof LINE }>;
const CONTEXT = 50;

const toLine = (r: Row): LogLine => ({ ...r, id: r.id.toString(), ts: r.ts.toISOString() });
/** Newest first; the id orders lines with the same time. */
const newer = (a: Row, b: Row) => b.ts.getTime() - a.ts.getTime() || (b.id > a.id ? 1 : b.id < a.id ? -1 : 0);

/**
 * App logs (written by the worker's log collector). Reads only: search,
 * scroll-back, and the lines around a hit. Every query is scoped to the
 * session's org, and to services checked to be in it.
 */
@Injectable()
export class LogsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * One page, newest first. For an environment, each service is read on its
   * own (each one an index scan on (serviceId, ts)) and the pages merged: one
   * query with serviceId IN (…) would sort every matching row first.
   */
  async list(orgId: string, q: ListLogsQuery): Promise<LogPage> {
    const serviceIds = await this.scope(orgId, q);
    const where: Prisma.ServiceLogWhereInput = { organizationId: orgId };
    // Prisma doesn't escape LIKE's wildcards: without this, "_" matches any character.
    if (q.q) where.message = { contains: q.q.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' };
    if (q.stream) where.stream = q.stream;
    if (q.deploymentId) where.deploymentId = q.deploymentId;
    if (q.from || q.to) where.ts = { ...(q.from && { gte: new Date(q.from) }), ...(q.to && { lte: new Date(q.to) }) };
    const before = q.before ? parseCursor(q.before) : null;
    const keyset: Prisma.ServiceLogWhereInput | null = before ? { OR: [{ ts: { lt: before.ts } }, { ts: before.ts, id: { lt: before.id } }] } : null;

    const pages = await Promise.all(
      serviceIds.map((serviceId) =>
        this.prisma.client.serviceLog.findMany({
          where: { ...where, serviceId, ...(keyset && { AND: [keyset] }) },
          orderBy: [{ ts: 'desc' }, { id: 'desc' }],
          take: q.limit + 1,
          select: LINE,
        }),
      ),
    );
    const rows = pages.flat().sort(newer);
    const page = rows.slice(0, q.limit);
    const last = page[page.length - 1];
    return { items: page.map(toLine), nextCursor: rows.length > q.limit && last ? `${last.ts.toISOString()}_${last.id}` : null };
  }

  /** The lines around one line of a service (a search hit), oldest first. */
  async context(orgId: string, id: string): Promise<LogContext> {
    if (!/^\d{1,19}$/.test(id)) throw new NotFoundException(LOG_MESSAGES.line_not_found);
    const line = await this.prisma.client.serviceLog.findFirst({ where: { id: BigInt(id), organizationId: orgId }, select: LINE });
    if (!line) throw new NotFoundException(LOG_MESSAGES.line_not_found);
    const base = { serviceId: line.serviceId, organizationId: orgId };
    const [earlier, later] = await Promise.all([
      this.prisma.client.serviceLog.findMany({
        where: { ...base, OR: [{ ts: { lt: line.ts } }, { ts: line.ts, id: { lt: line.id } }] },
        orderBy: [{ ts: 'desc' }, { id: 'desc' }],
        take: CONTEXT,
        select: LINE,
      }),
      this.prisma.client.serviceLog.findMany({
        where: { ...base, OR: [{ ts: { gt: line.ts } }, { ts: line.ts, id: { gt: line.id } }] },
        orderBy: [{ ts: 'asc' }, { id: 'asc' }],
        take: CONTEXT,
        select: LINE,
      }),
    ]);
    return { id, items: [...earlier.reverse(), line, ...later].map(toLine) };
  }

  /** For the live gateway: are all these services in the org? */
  async allInOrg(orgId: string, serviceIds: string[]): Promise<boolean> {
    const n = await this.prisma.client.service.count({ where: { id: { in: serviceIds }, organizationId: orgId } });
    return n === new Set(serviceIds).size;
  }

  /** The services a query reads: the one asked for, or every one in the environment. 404 if not in the org. */
  private async scope(orgId: string, q: ListLogsQuery): Promise<string[]> {
    if (q.serviceId) {
      const s = await this.prisma.client.service.findFirst({ where: { id: q.serviceId, organizationId: orgId }, select: { id: true } });
      if (!s) throw new NotFoundException(LOG_MESSAGES.service_not_found);
      return [s.id];
    }
    const env = await this.prisma.client.environment.findFirst({
      where: { id: q.environmentId, organizationId: orgId },
      select: { services: { select: { id: true }, take: LOG_SOCKET.maxWatch } },
    });
    if (!env) throw new NotFoundException(LOG_MESSAGES.environment_not_found);
    return env.services.map((s) => s.id);
  }
}

/** "2026-10-28T20:01:02.123Z_8812" → its time and id. */
export function parseCursor(c: string): { ts: Date; id: bigint } {
  const at = c.lastIndexOf('_');
  const ts = new Date(c.slice(0, at));
  const id = c.slice(at + 1);
  if (at < 0 || Number.isNaN(ts.getTime()) || !/^\d{1,19}$/.test(id)) throw new BadRequestException(LOG_MESSAGES.bad_cursor);
  return { ts, id: BigInt(id) };
}
