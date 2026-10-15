import {
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { cleanupPreview, DockerError } from 'docker-client';
import type { Prisma } from 'db';
import type {
  CleanupJob,
  CleanupPreview,
  DockerCleanup,
} from 'shared-types';
import { withSsh } from 'ssh-client';
import { decrypt } from 'warden-crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OrgKeyService } from '../warden-crypto/org-key.service';
import { SERVER_MESSAGES } from '../../common/constants/messages.config';
import type { Actor } from '../../common/types/actor';
import { CLEANUP_QUEUE } from './cleanup.queue';

/** A QUEUED/RUNNING row older than this is treated as dead, so a crashed worker can't block cleanups forever. */
const STALE_AFTER_MS = 30 * 60 * 1000;

const WITH_TRIGGERED_BY = {
  triggeredBy: { select: { firstName: true, lastName: true } },
} satisfies Prisma.DockerCleanupLogInclude;
type CleanupRow = Prisma.DockerCleanupLogGetPayload<{
  include: typeof WITH_TRIGGERED_BY;
}>;

/**
 * Docker cleanup. The preview is live (one SSH session, read-only commands);
 * the cleanup itself is a worker job, because pruning can take minutes and
 * the api never waits on a server that long.
 */
@Injectable()
export class CleanupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgKeys: OrgKeyService,
    private readonly audit: AuditService,
    @Inject(CLEANUP_QUEUE) private readonly queue: Queue,
  ) {}

  async preview(orgId: string, serverId: string): Promise<CleanupPreview> {
    const server = await this.prisma.client.server.findFirst({
      where: { id: serverId, organizationId: orgId },
      include: { serverSshKey: { select: { privateKeyEncrypted: true } } },
    });
    if (!server) throw new NotFoundException(SERVER_MESSAGES.not_found);

    const privateKey = decrypt(server.serverSshKey.privateKeyEncrypted, {
      v1: await this.orgKeys.getDek(orgId),
    });
    try {
      return await withSsh(
        {
          host: server.serverIp,
          port: server.serverPort,
          username: server.serverSSHUsername,
          privateKey,
        },
        cleanupPreview,
      );
    } catch (e) {
      // Docker's own reason ("isn't installed", "can't use Docker") is safe to show.
      if (e instanceof DockerError) throw new ConflictException(e.message);
      throw new BadGatewayException(SERVER_MESSAGES.unreachable);
    }
  }

  async start(actor: Actor, serverId: string): Promise<DockerCleanup> {
    const orgId = actor.organizationId;
    const server = await this.prisma.client.server.findFirst({
      where: { id: serverId, organizationId: orgId },
      select: { id: true, serverName: true },
    });
    if (!server) throw new NotFoundException(SERVER_MESSAGES.not_found);

    const busy = await this.prisma.client.dockerCleanupLog.findFirst({
      where: {
        serverId,
        status: { in: ['QUEUED', 'RUNNING'] },
        createdAt: { gte: new Date(Date.now() - STALE_AFTER_MS) },
      },
      select: { id: true },
    });
    if (busy) throw new ConflictException(SERVER_MESSAGES.cleanup_running);

    const row = await this.prisma.client.dockerCleanupLog.create({
      data: { serverId, triggeredById: actor.userId },
      include: WITH_TRIGGERED_BY,
    });
    try {
      await this.queue.add(
        'docker-cleanup',
        {
          cleanupId: row.id,
          serverId,
          organizationId: orgId,
        } satisfies CleanupJob,
      );
    } catch {
      await this.prisma.client.dockerCleanupLog.update({
        where: { id: row.id },
        data: {
          status: 'FAILED',
          errorMessage: 'Could not queue the cleanup',
          finishedAt: new Date(),
        },
      });
      throw new ServiceUnavailableException(SERVER_MESSAGES.cleanup_not_queued);
    }

    await this.audit.record(actor, {
      action: 'server.cleanup_run',
      entityType: 'server',
      entityId: server.id,
      metadata: { name: server.serverName },
    });
    return toCleanup(row);
  }

  /** The last 10 runs, newest first. The UI polls this while one is running. */
  async list(orgId: string, serverId: string): Promise<DockerCleanup[]> {
    const rows = await this.prisma.client.dockerCleanupLog.findMany({
      where: { serverId, server: { organizationId: orgId } },
      include: WITH_TRIGGERED_BY,
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return rows.map(toCleanup);
  }
}

function toCleanup(row: CleanupRow): DockerCleanup {
  return {
    id: row.id,
    serverId: row.serverId,
    status: row.status,
    reclaimedBytes: row.reclaimedBytes,
    errorMessage: row.errorMessage,
    triggeredBy: row.triggeredBy
      ? `${row.triggeredBy.firstName} ${row.triggeredBy.lastName}`.trim()
      : null,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}
