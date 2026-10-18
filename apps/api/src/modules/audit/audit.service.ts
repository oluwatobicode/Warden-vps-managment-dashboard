import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { AuditLog as AuditLogRow, Prisma } from 'db';
import type {
  AuditAction,
  AuditEntityType,
  AuditLog,
  AuditLogPage,
  AuditMetadata,
  ListAuditLogsQuery,
} from 'shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { PROJECT_MESSAGES } from '../../common/constants/messages.config';
import type { Actor } from '../../common/types/actor';

export interface AuditEntry {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  metadata?: AuditMetadata;
  /** Project-scoped events (project, environment, variable) set this, for the project's Activity tab. */
  projectId?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(actor: Actor, entry: AuditEntry): Promise<void> {
    try {
      const [user, token] = await Promise.all([
        actor.userId
          ? this.prisma.client.user.findUnique({
              where: { id: actor.userId },
              select: { email: true },
            })
          : null,
        actor.apiTokenId
          ? this.prisma.client.apiToken.findUnique({
              where: { id: actor.apiTokenId },
              select: { apiName: true },
            })
          : null,
      ]);

      await this.prisma.client.auditLog.create({
        data: {
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          metadata: entry.metadata,
          organizationId: actor.organizationId,
          projectId: entry.projectId ?? null,
          performedById: actor.userId,
          performedByEmail: user?.email ?? null,
          performedByRole: actor.role,
          apiTokenId: actor.apiTokenId,
          apiTokenName: token?.apiName ?? null,
        },
      });
    } catch (e) {
      this.logger.warn(
        `audit write failed (${entry.action}): ${(e as Error).message}`,
      );
    }
  }

  /** The whole org's log. Admin-only (see AuditController). */
  list(orgId: string, query: ListAuditLogsQuery): Promise<AuditLogPage> {
    return this.page({ organizationId: orgId }, query);
  }

  /**
   * One project's events, for every role. The project must be in the
   * caller's org, otherwise 404 (never an empty list that hints it exists).
   */
  async listForProject(
    orgId: string,
    projectId: string,
    query: ListAuditLogsQuery,
  ): Promise<AuditLogPage> {
    const project = await this.prisma.client.project.findFirst({
      where: { id: projectId, organizationId: orgId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException(PROJECT_MESSAGES.not_found);
    return this.page({ organizationId: orgId, projectId }, query);
  }

  /** Newest first, cursor-paged. Both lists share it, so they page the same way. */
  private async page(
    where: Prisma.AuditLogWhereInput,
    query: ListAuditLogsQuery,
  ): Promise<AuditLogPage> {
    const rows = await this.prisma.client.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });

    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: items.map(toAuditLog),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }
}

function toAuditLog(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    metadata: row.metadata as Record<string, unknown> | null,
    performedById: row.performedById,
    performedByEmail: row.performedByEmail,
    performedByRole: row.performedByRole,
    apiTokenId: row.apiTokenId,
    apiTokenName: row.apiTokenName,
    createdAt: row.createdAt.toISOString(),
  };
}
