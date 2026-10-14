import { Injectable, NotFoundException } from '@nestjs/common';
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

    const row = await this.prisma.client.apiToken.create({
      data: {
        apiName: input.apiName,
        apiTokenScope: input.apiTokenScope,
        tokenHash: sha256(raw),
        tokenPrefix: raw.slice(0, API_TOKEN.displayPrefixLength),
        expiresAt,
        organizationId: orgId,
      },
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
      },
    });

    return { ...toApiToken(row), token: raw };
  }

  async listTokens(orgId: string): Promise<ApiToken[]> {
    const rows = await this.prisma.client.apiToken.findMany({
      where: { organizationId: orgId },
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

function toApiToken(row: ApiTokenRow): ApiToken {
  return {
    id: row.id,
    apiName: row.apiName,
    tokenPrefix: row.tokenPrefix,
    apiTokenScope: row.apiTokenScope,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
