import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { Actor } from '../../common/types/actor';
import {
  API_TOKEN,
  API_TOKEN_EXPIRY_DAYS,
} from '../../common/constants/constants.config';
import { randomToken, sha256 } from '../../common/utils/token.util';
import type {
  ApiToken,
  CreateApiTokenInput,
  CreatedApiToken,
} from 'shared-types';
import type { ApiToken as ApiTokenRow } from 'db';
import { API_TOKEN_MESSAGES } from '../../common/constants/messages.config';

@Injectable()
export class ApiTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createToken(
    actor: Actor,
    input: CreateApiTokenInput,
  ): Promise<CreatedApiToken> {
    const orgId = actor.organizationId;
    const raw = `${API_TOKEN.prefix}${randomToken()}`;

    const days = API_TOKEN_EXPIRY_DAYS[input.expiresIn];

    const expiresAt =
      days === null ? null : new Date(Date.now() + days * 86_400_000);

    // The project must be this org's (the composite FK would refuse it too,
    // but with a P2003 instead of a clear message).
    const project = input.projectId
      ? await this.prisma.client.project.findFirst({
          where: { id: input.projectId, organizationId: orgId },
          select: { id: true, projectName: true },
        })
      : null;
    if (input.projectId && !project) {
      throw new BadRequestException(API_TOKEN_MESSAGES.project_not_found);
    }

    const row = await this.prisma.client.apiToken.create({
      data: {
        apiName: input.apiName,
        apiTokenScope: input.apiTokenScope,
        tokenHash: sha256(raw),
        tokenPrefix: raw.slice(0, API_TOKEN.displayPrefixLength),
        expiresAt,
        organizationId: orgId,
        projectId: project?.id ?? null,
      },
      include: { project: { select: { projectName: true } } },
    });

    // Never log `raw`: the audit log is not a place for secrets.
    await this.audit.record(actor, {
      action: 'api_token.created',
      entityType: 'api_token',
      entityId: row.id,
      metadata: {
        name: row.apiName,
        scope: row.apiTokenScope,
        expiresIn: input.expiresIn,
        project: project?.projectName ?? null,
      },
    });

    return { ...toApiToken(row), token: raw };
  }

  async listTokens(orgId: string): Promise<ApiToken[]> {
    const rows = await this.prisma.client.apiToken.findMany({
      where: { organizationId: orgId },
      include: { project: { select: { projectName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toApiToken);
  }

  async revokeToken(actor: Actor, id: string): Promise<void> {
    const orgId = actor.organizationId;
    const findToken = await this.prisma.client.apiToken.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!findToken) {
      throw new NotFoundException(API_TOKEN_MESSAGES.not_found);
    }

    await this.prisma.client.apiToken.delete({ where: { id: findToken.id } });

    await this.audit.record(actor, {
      action: 'api_token.revoked',
      entityType: 'api_token',
      entityId: findToken.id,
      metadata: { name: findToken.apiName },
    });
  }
}

function toApiToken(
  row: ApiTokenRow & { project: { projectName: string } | null },
): ApiToken {
  return {
    id: row.id,
    apiName: row.apiName,
    tokenPrefix: row.tokenPrefix,
    apiTokenScope: row.apiTokenScope,
    projectId: row.projectId,
    projectName: row.project?.projectName ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
