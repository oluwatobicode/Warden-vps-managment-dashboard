import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'db';
import type {
  CreateEnvironmentVariableInput,
  CreateServiceVariableInput,
  ResolvedVariable,
  RevealedVariable,
  UpdateVariableInput,
  Variable,
  VariableScope,
} from 'shared-types';
import { decrypt, encrypt } from 'warden-crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { OrgKeyService } from '../warden-crypto/org-key.service';
import {
  ENVIRONMENT_MESSAGES,
  SERVICE_MESSAGES,
  VARIABLE_MESSAGES,
} from '../../common/constants/messages.config';

@Injectable()
export class VariableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgKeys: OrgKeyService,
  ) {}

  private async seal(orgId: string, value: string): Promise<string> {
    return encrypt(value, await this.orgKeys.getDek(orgId), 'v1');
  }

  private async mapRows(
    orgId: string,
    rows: VariableRow[],
    scope: VariableScope,
  ): Promise<Variable[]> {
    if (rows.length === 0) return [];
    const dek = await this.orgKeys.getDek(orgId);
    return rows.map((row) =>
      toVariable(
        row,
        scope,
        row.isSecret ? null : decrypt(row.valueEncrypted, { v1: dek }),
      ),
    );
  }

  private async mapOne(orgId: string, row: VariableRow, scope: VariableScope) {
    return (await this.mapRows(orgId, [row], scope))[0];
  }

  private async assertEnvironmentInOrg(orgId: string, environmentId: string) {
    const env = await this.prisma.client.environment.findFirst({
      where: { id: environmentId, organizationId: orgId },
      select: { id: true },
    });
    if (!env) throw new NotFoundException(ENVIRONMENT_MESSAGES.not_found);
  }

  private async assertServiceInOrg(orgId: string, serviceId: string) {
    const svc = await this.prisma.client.service.findFirst({
      where: { id: serviceId, organizationId: orgId },
      select: { id: true, environmentId: true },
    });
    if (!svc) throw new NotFoundException(SERVICE_MESSAGES.not_found);
    return svc;
  }

  private keyTaken(e: unknown): unknown {
    return e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
      ? new ConflictException(VARIABLE_MESSAGES.key_taken)
      : e;
  }

  async listForEnvironment(
    orgId: string,
    environmentId: string,
  ): Promise<Variable[]> {
    await this.assertEnvironmentInOrg(orgId, environmentId);
    const rows = await this.prisma.client.environmentVariable.findMany({
      where: { environmentId, organizationId: orgId },
      orderBy: { key: 'asc' },
    });
    return this.mapRows(orgId, rows, 'environment');
  }

  async createForEnvironment(
    orgId: string,
    input: CreateEnvironmentVariableInput,
  ): Promise<Variable> {
    await this.assertEnvironmentInOrg(orgId, input.environmentId);
    try {
      const row = await this.prisma.client.environmentVariable.create({
        data: {
          key: input.key,
          valueEncrypted: await this.seal(orgId, input.value),
          isSecret: input.isSecret,
          environmentId: input.environmentId,
          organizationId: orgId,
        },
      });
      return this.mapOne(orgId, row, 'environment');
    } catch (e) {
      throw this.keyTaken(e);
    }
  }

  async updateEnvironmentVariable(
    orgId: string,
    id: string,
    input: UpdateVariableInput,
  ): Promise<Variable> {
    await this.findEnvironmentVariable(orgId, id);
    const row = await this.prisma.client.environmentVariable.update({
      where: { id },
      data: {
        ...(input.value !== undefined && {
          valueEncrypted: await this.seal(orgId, input.value),
        }),
        isSecret: input.isSecret,
      },
    });
    return this.mapOne(orgId, row, 'environment');
  }

  async deleteEnvironmentVariable(orgId: string, id: string): Promise<void> {
    await this.findEnvironmentVariable(orgId, id);
    await this.prisma.client.environmentVariable.delete({ where: { id } });
  }

  async revealEnvironmentVariable(
    orgId: string,
    id: string,
  ): Promise<RevealedVariable> {
    const row = await this.findEnvironmentVariable(orgId, id);
    // TODO(audit log): record that this user revealed this key.
    return {
      key: row.key,
      value: decrypt(row.valueEncrypted, {
        v1: await this.orgKeys.getDek(orgId),
      }),
    };
  }

  private async findEnvironmentVariable(orgId: string, id: string) {
    const row = await this.prisma.client.environmentVariable.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!row) throw new NotFoundException(VARIABLE_MESSAGES.not_found);
    return row;
  }

  async listForService(orgId: string, serviceId: string): Promise<Variable[]> {
    await this.assertServiceInOrg(orgId, serviceId);
    const rows = await this.prisma.client.serviceVariable.findMany({
      where: { serviceId, organizationId: orgId },
      orderBy: { key: 'asc' },
    });
    return this.mapRows(orgId, rows, 'service');
  }

  async createForService(
    orgId: string,
    input: CreateServiceVariableInput,
  ): Promise<Variable> {
    await this.assertServiceInOrg(orgId, input.serviceId);
    try {
      const row = await this.prisma.client.serviceVariable.create({
        data: {
          key: input.key,
          valueEncrypted: await this.seal(orgId, input.value),
          isSecret: input.isSecret,
          serviceId: input.serviceId,
          organizationId: orgId,
        },
      });
      return this.mapOne(orgId, row, 'service');
    } catch (e) {
      throw this.keyTaken(e);
    }
  }

  async updateServiceVariable(
    orgId: string,
    id: string,
    input: UpdateVariableInput,
  ): Promise<Variable> {
    await this.findServiceVariable(orgId, id);
    const row = await this.prisma.client.serviceVariable.update({
      where: { id },
      data: {
        ...(input.value !== undefined && {
          valueEncrypted: await this.seal(orgId, input.value),
        }),
        isSecret: input.isSecret,
      },
    });
    return this.mapOne(orgId, row, 'service');
  }

  async deleteServiceVariable(orgId: string, id: string): Promise<void> {
    await this.findServiceVariable(orgId, id);
    await this.prisma.client.serviceVariable.delete({ where: { id } });
  }

  async revealServiceVariable(
    orgId: string,
    id: string,
  ): Promise<RevealedVariable> {
    const row = await this.findServiceVariable(orgId, id);
    // TODO(audit log): record that this user revealed this key.
    return {
      key: row.key,
      value: decrypt(row.valueEncrypted, {
        v1: await this.orgKeys.getDek(orgId),
      }),
    };
  }

  private async findServiceVariable(orgId: string, id: string) {
    const row = await this.prisma.client.serviceVariable.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!row) throw new NotFoundException(VARIABLE_MESSAGES.not_found);
    return row;
  }

  // ── resolution ─────────────────────────────────────────────────────────────

  /**
   * What a service's container would receive: environment variables first,
   * then the service's own on top. Map.set on an existing key REPLACES it, so
   * "same name, the service wins" is one line. Secrets masked for the API;
   * the deploy worker will call this with { reveal: true }.
   */
  async resolveForService(
    orgId: string,
    serviceId: string,
    opts: { reveal?: boolean } = {},
  ): Promise<ResolvedVariable[]> {
    const svc = await this.assertServiceInOrg(orgId, serviceId);
    const [envRows, svcRows] = await Promise.all([
      this.prisma.client.environmentVariable.findMany({
        where: { environmentId: svc.environmentId, organizationId: orgId },
      }),
      this.prisma.client.serviceVariable.findMany({
        where: { serviceId, organizationId: orgId },
      }),
    ]);
    if (envRows.length === 0 && svcRows.length === 0) return [];

    const dek = await this.orgKeys.getDek(orgId);
    const show = (row: VariableRow) =>
      row.isSecret && !opts.reveal
        ? null
        : decrypt(row.valueEncrypted, { v1: dek });

    const merged = new Map<string, ResolvedVariable>();
    for (const row of envRows) {
      merged.set(row.key, {
        key: row.key,
        value: show(row),
        isSecret: row.isSecret,
        source: 'environment',
      });
    }
    for (const row of svcRows) {
      merged.set(row.key, {
        key: row.key,
        value: show(row),
        isSecret: row.isSecret,
        source: 'service',
      }); // overrides
    }
    return [...merged.values()].sort((a, b) => a.key.localeCompare(b.key));
  }
}

type VariableRow = {
  id: string;
  key: string;
  valueEncrypted: string;
  isSecret: boolean;
  updatedAt: Date;
};

function toVariable(
  row: VariableRow,
  scope: VariableScope,
  value: string | null,
): Variable {
  return {
    id: row.id,
    key: row.key,
    value,
    isSecret: row.isSecret,
    scope,
    updatedAt: row.updatedAt.toISOString(),
  };
}
