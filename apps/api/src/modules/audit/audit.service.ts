import { Injectable, Logger } from '@nestjs/common';
import type { AuditLog as AuditLogRow } from 'db';
import type {
  AuditAction,
  AuditEntityType,
  AuditLog,
  AuditLogPage,
  AuditMetadata,
  ListAuditLogsQuery,
} from 'shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import type { Actor } from '../../common/types/actor';

export interface AuditEntry {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  metadata?: AuditMetadata;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Write one audit line. NEVER throws: if the write fails the real action
   * has already succeeded, so we only warn. Call it AFTER the action's own
   * write, so a failed action leaves no line.
   */
  async record(actor: Actor, entry: AuditEntry): Promise<void> {
    try {
      // Snapshot the email / token name onto the row so the line stays
      // readable after the user or token is deleted (their FKs SetNull).
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

  /**
   * Newest first, one page at a time. Fetch limit + 1: if the extra row
   * exists there is another page, and the last row we return is the cursor.
   * A cursor (not ?page=N) because new rows keep arriving at the top.
   */
  async list(orgId: string, query: ListAuditLogsQuery): Promise<AuditLogPage> {
    const rows = await this.prisma.client.auditLog.findMany({
      where: { organizationId: orgId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], // id breaks same-ms ties
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
