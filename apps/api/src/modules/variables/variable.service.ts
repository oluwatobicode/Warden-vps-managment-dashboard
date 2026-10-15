import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'db';
import type {
  BulkConflict,
  BulkEnvironmentVariablesInput,
  BulkResult,
  BulkServiceVariablesInput,
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
import { AuditService } from '../audit/audit.service';
import type { Actor } from '../../common/types/actor';
import { OrgKeyService } from '../warden-crypto/org-key.service';
import {
  ENVIRONMENT_MESSAGES,
  SERVICE_MESSAGES,
  VARIABLE_MESSAGES,
} from '../../common/constants/messages.config';

/** One import row, already encrypted. */
interface SealedRow {
  key: string;
  valueEncrypted: string;
  isSecret: boolean;
}

/** How importRows reaches one of the two variable tables inside a transaction. */
interface ImportTable {
  existing: (tx: Prisma.TransactionClient, keys: string[]) => Promise<Array<{ id: string; key: string }>>;
  createMany: (tx: Prisma.TransactionClient, rows: SealedRow[]) => Promise<unknown>;
  update: (tx: Prisma.TransactionClient, id: string, row: SealedRow) => Promise<unknown>;
}

@Injectable()
export class VariableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgKeys: OrgKeyService,
    private readonly audit: AuditService,
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
    actor: Actor,
    id: string,
  ): Promise<RevealedVariable> {
    const orgId = actor.organizationId;
    const row = await this.findEnvironmentVariable(orgId, id);
    // The NAME is logged, never the value.
    await this.audit.record(actor, {
      action: 'variable.revealed',
      entityType: 'variable',
      entityId: row.id,
      metadata: { key: row.key, scope: 'environment' },
    });
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
    actor: Actor,
    id: string,
  ): Promise<RevealedVariable> {
    const orgId = actor.organizationId;
    const row = await this.findServiceVariable(orgId, id);
    // The NAME is logged, never the value.
    await this.audit.record(actor, {
      action: 'variable.revealed',
      entityType: 'variable',
      entityId: row.id,
      metadata: { key: row.key, scope: 'service' },
    });
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

  // ── bulk import (.env) ───────────────────────────────────────────────────────

  async importForEnvironment(actor: Actor, input: BulkEnvironmentVariablesInput): Promise<BulkResult> {
    const orgId = actor.organizationId;
    const { environmentId } = input;
    await this.assertEnvironmentInOrg(orgId, environmentId);
    return this.importRows(actor, 'environment', environmentId, input, {
      existing: (tx, keys) =>
        tx.environmentVariable.findMany({
          where: { environmentId, organizationId: orgId, key: { in: keys } },
          select: { id: true, key: true },
        }),
      createMany: (tx, rows) =>
        tx.environmentVariable.createMany({
          data: rows.map((r) => ({ ...r, environmentId, organizationId: orgId })),
        }),
      update: (tx, id, r) =>
        tx.environmentVariable.update({
          where: { id },
          data: { valueEncrypted: r.valueEncrypted, isSecret: r.isSecret },
        }),
    });
  }

  async importForService(actor: Actor, input: BulkServiceVariablesInput): Promise<BulkResult> {
    const orgId = actor.organizationId;
    const { serviceId } = input;
    await this.assertServiceInOrg(orgId, serviceId);
    return this.importRows(actor, 'service', serviceId, input, {
      existing: (tx, keys) =>
        tx.serviceVariable.findMany({
          where: { serviceId, organizationId: orgId, key: { in: keys } },
          select: { id: true, key: true },
        }),
      createMany: (tx, rows) =>
        tx.serviceVariable.createMany({
          data: rows.map((r) => ({ ...r, serviceId, organizationId: orgId })),
        }),
      update: (tx, id, r) =>
        tx.serviceVariable.update({
          where: { id },
          data: { valueEncrypted: r.valueEncrypted, isSecret: r.isSecret },
        }),
    });
  }

  /**
   * All or nothing: every row is written in ONE transaction, so a bad row or a
   * crash halfway leaves the table exactly as it was.
   */
  private async importRows(
    actor: Actor,
    scope: VariableScope,
    ownerId: string,
    input: { variables: Array<{ key: string; value: string; isSecret: boolean }>; onConflict: BulkConflict },
    table: ImportTable,
  ): Promise<BulkResult> {
    // Encrypt BEFORE the transaction: a transaction should hold its locks for
    // as short a time as possible, and encryption doesn't need the database.
    const dek = await this.orgKeys.getDek(actor.organizationId);
    const rows: SealedRow[] = input.variables.map((v) => ({
      key: v.key,
      valueEncrypted: encrypt(v.value, dek, 'v1'),
      isSecret: v.isSecret,
    }));

    let result: BulkResult;
    try {
      // Inside here, use `tx` only: anything sent through this.prisma.client
      // would NOT be part of the transaction and would survive a rollback.
      result = await this.prisma.client.$transaction(async (tx) => {
        const idByKey = new Map((await table.existing(tx, rows.map((r) => r.key))).map((e) => [e.key, e.id]));
        const fresh = rows.filter((r) => !idByKey.has(r.key));
        const clashing = rows.filter((r) => idByKey.has(r.key));

        if (fresh.length) await table.createMany(tx, fresh);
        if (input.onConflict === 'overwrite') {
          for (const r of clashing) await table.update(tx, idByKey.get(r.key)!, r);
        }

        return {
          added: fresh.map((r) => r.key),
          updated: input.onConflict === 'overwrite' ? clashing.map((r) => r.key) : [],
          skipped: input.onConflict === 'skip' ? clashing.map((r) => r.key) : [],
        };
      });
    } catch (e) {
      // Someone created one of these keys between our read and our write: the
      // unique index fired and the whole import rolled back. Say so plainly.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(VARIABLE_MESSAGES.import_conflict);
      }
      throw e;
    }

    // One audit line for the import, after it committed. Counts, never values.
    await this.audit.record(actor, {
      action: 'variable.imported',
      entityType: 'variable',
      entityId: ownerId,
      metadata: { scope, added: result.added.length, updated: result.updated.length, skipped: result.skipped.length },
    });
    return result;
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
