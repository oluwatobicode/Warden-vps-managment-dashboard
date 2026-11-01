import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from 'db';
import {
  serverLogChannel,
  serverSourcesKey,
  SourceStateSchema,
  type ListServerLogsQuery,
  type ServerLogContext,
  type ServerLogLine,
  type ServerLogPage,
  type ServerLogSources,
} from 'shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { LOG_MESSAGES } from '../../common/constants/messages.config';
import { parseCursor } from './logs.service';

const LINE = { id: true, serverId: true, source: true, ts: true, message: true } satisfies Prisma.ServerLogSelect;
type Row = Prisma.ServerLogGetPayload<{ select: typeof LINE }>;
const CONTEXT = 50;
const toLine = (r: Row): ServerLogLine => ({ ...r, id: r.id.toString(), ts: r.ts.toISOString() });

/**
 * A server's own logs (written by the worker's log collector and its jobs).
 * Same reads as LogsService, for one server checked against the session's org.
 */
@Injectable()
export class ServerLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async list(orgId: string, q: ListServerLogsQuery): Promise<ServerLogPage> {
    await this.server(orgId, q.serverId);
    const where: Prisma.ServerLogWhereInput = { organizationId: orgId, serverId: q.serverId };
    // Prisma doesn't escape LIKE's wildcards (see LogsService).
    if (q.q) where.message = { contains: q.q.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' };
    if (q.source) where.source = q.source;
    if (q.from || q.to) where.ts = { ...(q.from && { gte: new Date(q.from) }), ...(q.to && { lte: new Date(q.to) }) };
    const before = q.before ? parseCursor(q.before) : null;
    if (before) where.AND = [{ OR: [{ ts: { lt: before.ts } }, { ts: before.ts, id: { lt: before.id } }] }];
    const rows = await this.prisma.client.serverLog.findMany({ where, orderBy: [{ ts: 'desc' }, { id: 'desc' }], take: q.limit + 1, select: LINE });
    const page = rows.slice(0, q.limit);
    const last = page[page.length - 1];
    return { items: page.map(toLine), nextCursor: rows.length > q.limit && last ? `${last.ts.toISOString()}_${last.id}` : null };
  }

  /** The lines around one line, from all of the server's sources, oldest first. */
  async context(orgId: string, id: string): Promise<ServerLogContext> {
    if (!/^\d{1,19}$/.test(id)) throw new NotFoundException(LOG_MESSAGES.line_not_found);
    const line = await this.prisma.client.serverLog.findFirst({ where: { id: BigInt(id), organizationId: orgId }, select: LINE });
    if (!line) throw new NotFoundException(LOG_MESSAGES.line_not_found);
    const base = { serverId: line.serverId, organizationId: orgId };
    const [earlier, later] = await Promise.all([
      this.prisma.client.serverLog.findMany({
        where: { ...base, OR: [{ ts: { lt: line.ts } }, { ts: line.ts, id: { lt: line.id } }] },
        orderBy: [{ ts: 'desc' }, { id: 'desc' }],
        take: CONTEXT,
        select: LINE,
      }),
      this.prisma.client.serverLog.findMany({
        where: { ...base, OR: [{ ts: { gt: line.ts } }, { ts: line.ts, id: { gt: line.id } }] },
        orderBy: [{ ts: 'asc' }, { id: 'asc' }],
        take: CONTEXT,
        select: LINE,
      }),
    ]);
    return { id, items: [...earlier.reverse(), line, ...later].map(toLine) };
  }

  /** Which sources the worker can read on this server (it checks every 30 s while connected). */
  async sources(orgId: string, serverId: string): Promise<ServerLogSources> {
    const server = await this.server(orgId, serverId);
    const saved = await this.redis.hgetall(serverSourcesKey(serverId));
    const state = (v: string | undefined) => SourceStateSchema.catch('unknown').parse(v ?? 'unknown');
    return {
      sshUser: server.serverSSHUsername,
      sources: [
        { source: 'TRAEFIK', state: state(saved.TRAEFIK) },
        { source: 'DOCKER', state: state(saved.DOCKER) },
        { source: 'SYSTEM', state: state(saved.SYSTEM) },
        { source: 'WARDEN', state: 'ok' },
      ],
    };
  }

  /** For the live gateway. */
  async inOrg(orgId: string, serverId: string): Promise<boolean> {
    return (await this.prisma.client.server.count({ where: { id: serverId, organizationId: orgId } })) === 1;
  }

  private async server(orgId: string, id: string) {
    const s = await this.prisma.client.server.findFirst({ where: { id, organizationId: orgId }, select: { id: true, serverSSHUsername: true } });
    if (!s) throw new NotFoundException(LOG_MESSAGES.server_not_found);
    return s;
  }
}

/**
 * A line Warden writes in a server's log itself (e.g. a proxy change), saved
 * and sent live like the worker's. Never throws: the change already happened.
 */
export async function recordServerEvent(prisma: PrismaService, redis: RedisService, server: { id: string; organizationId: string }, message: string): Promise<void> {
  try {
    const r = await prisma.client.serverLog.create({
      data: { organizationId: server.organizationId, serverId: server.id, source: 'WARDEN', ts: new Date(), message },
      select: LINE,
    });
    await redis.publish(serverLogChannel(server.id), JSON.stringify([toLine(r)]));
  } catch {
    // A missing log line isn't worth failing the request over.
  }
}
