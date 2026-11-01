import { BadGatewayException, BadRequestException, ConflictException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { bridgeCommand, q } from 'docker-client';
import {
  DATABASE_CATALOG,
  type DataRows,
  type DataRowsQuery,
  type DataTables,
  type DeleteRedisKeysInput,
  type DeleteRowsInput,
  type InsertRowInput,
  type RedisCommandInput,
  type RedisCommandResult,
  type RedisKeys,
  type RedisKeysQuery,
  type RedisValue,
  type RowsChanged,
  type RunQueryInput,
  type RunQueryResult,
  type SetRedisStringInput,
  type UpdateRowInput,
} from 'shared-types';
import { SshError, withSsh } from 'ssh-client';
import { decrypt } from 'warden-crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { OrgKeyService } from '../warden-crypto/org-key.service';
import { AuditService } from '../audit/audit.service';
import { DATA_MESSAGES } from '../../common/constants/messages.config';
import type { Actor } from '../../common/types/actor';
import { Bridge } from './bridge';
import { RedisEngine } from './redis-engine';
import { MysqlEngine, PostgresEngine, type SqlEngine } from './sql-engines';

type Opened = { kind: 'sql'; engine: SqlEngine } | { kind: 'redis'; engine: RedisEngine };

/**
 * The data browser. Each call opens SSH to the database's server, a bridge
 * into its container, and a driver over that, does one thing and closes it
 * all, in the request (like stop/start, not a worker job). Developer and up;
 * every SQL or Redis command, and every edit, is audit-logged (never the
 * results or the values).
 */
@Injectable()
export class DatabaseDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgKeys: OrgKeyService,
    private readonly audit: AuditService,
  ) {}

  tables(orgId: string, serviceId: string): Promise<DataTables> {
    return this.sql(orgId, serviceId, async (e) => ({ engine: e.engine, database: e.database, tables: await e.tables() }));
  }

  rows(orgId: string, q: DataRowsQuery): Promise<DataRows> {
    return this.sql(orgId, q.serviceId, async (e) => {
      const columns = await e.columns(q.schema, q.table);
      const page = await e.page(q.schema, q.table, columns, q);
      return { columns, ...page, editable: columns.some((c) => c.pk) };
    });
  }

  async run(actor: Actor, input: RunQueryInput): Promise<RunQueryResult> {
    const started = Date.now();
    const out = await this.sql(actor.organizationId, input.serviceId, (e) => e.run(input.sql, input.allowWrites));
    await this.recordQuery(actor, input.serviceId, input.sql, input.allowWrites);
    return { ...out, ms: Date.now() - started };
  }

  async update(actor: Actor, input: UpdateRowInput): Promise<RowsChanged> {
    const changed = await this.sql(actor.organizationId, input.serviceId, (e) => e.update(input.schema, input.table, input.key, input.values));
    await this.recordChange(actor, input.serviceId, { table: input.table, change: 'updated', rows: changed, columns: Object.keys(input.values).join(', ') });
    return { changed };
  }

  async insert(actor: Actor, input: InsertRowInput): Promise<RowsChanged> {
    const changed = await this.sql(actor.organizationId, input.serviceId, (e) => e.insert(input.schema, input.table, input.values));
    await this.recordChange(actor, input.serviceId, { table: input.table, change: 'inserted', rows: changed });
    return { changed };
  }

  async remove(actor: Actor, input: DeleteRowsInput): Promise<RowsChanged> {
    if (input.confirm !== input.table) throw new BadRequestException(DATA_MESSAGES.confirm_mismatch);
    const changed = await this.sql(actor.organizationId, input.serviceId, (e) => e.remove(input.schema, input.table, input.keys));
    await this.recordChange(actor, input.serviceId, { table: input.table, change: 'deleted', rows: changed });
    return { changed };
  }

  keys(orgId: string, q: RedisKeysQuery): Promise<RedisKeys> {
    return this.redis(orgId, q.serviceId, (r) => r.keys(q.pattern, q.cursor));
  }

  value(orgId: string, serviceId: string, key: string): Promise<RedisValue> {
    return this.redis(orgId, serviceId, (r) => r.value(key));
  }

  async command(actor: Actor, input: RedisCommandInput): Promise<RedisCommandResult> {
    const started = Date.now();
    const out = await this.redis(actor.organizationId, input.serviceId, (r) => r.command(input.command, input.allowWrites));
    await this.recordQuery(actor, input.serviceId, input.command, input.allowWrites);
    return { ...out, ms: Date.now() - started };
  }

  async setString(actor: Actor, input: SetRedisStringInput): Promise<RowsChanged> {
    await this.redis(actor.organizationId, input.serviceId, (r) => r.setString(input.key, input.value, input.ttlSeconds));
    await this.recordChange(actor, input.serviceId, { table: 'keys', change: 'set', rows: 1, key: input.key.slice(0, 200) });
    return { changed: 1 };
  }

  async removeKeys(actor: Actor, input: DeleteRedisKeysInput): Promise<RowsChanged> {
    const changed = await this.redis(actor.organizationId, input.serviceId, (r) => r.remove(input.keys));
    await this.recordChange(actor, input.serviceId, { table: 'keys', change: 'deleted', rows: changed, key: input.keys[0]!.slice(0, 200) });
    return { changed };
  }

  // ── connecting ──────────────────────────────────────────────────────────

  private async sql<T>(orgId: string, serviceId: string, fn: (e: SqlEngine) => Promise<T>): Promise<T> {
    return this.open(orgId, serviceId, (o) => {
      if (o.kind !== 'sql') throw new BadRequestException(DATA_MESSAGES.wrong_engine);
      return fn(o.engine);
    });
  }

  private async redis<T>(orgId: string, serviceId: string, fn: (e: RedisEngine) => Promise<T>): Promise<T> {
    return this.open(orgId, serviceId, (o) => {
      if (o.kind !== 'redis') throw new BadRequestException(DATA_MESSAGES.wrong_engine);
      return fn(o.engine);
    });
  }

  private async open<T>(orgId: string, serviceId: string, fn: (o: Opened) => Promise<T>): Promise<T> {
    const db = await this.prisma.client.serviceDatabase.findFirst({
      where: { serviceId, organizationId: orgId },
      include: { service: { include: { server: { include: { serverSshKey: { select: { privateKeyEncrypted: true } } } } } } },
    });
    if (!db) throw new NotFoundException(DATA_MESSAGES.database_not_found);
    const server = db.service.server;
    if (!server) throw new ConflictException(DATA_MESSAGES.not_placed);
    const dek = await this.orgKeys.getDek(orgId);
    const password = decrypt(db.passwordEncrypted, { v1: dek });
    const target = {
      host: server.serverIp,
      port: server.serverPort,
      username: server.serverSSHUsername,
      privateKey: decrypt(server.serverSshKey.privateKeyEncrypted, { v1: dek }),
    };

    let bridge: Bridge | null = null;
    try {
      return await withSsh(target, async (run, stream) => {
        const state = await run(`docker inspect -f '{{.State.Running}}' ${q(db.containerName)}`);
        if (state.stdout.trim() !== 'true') throw new ConflictException(DATA_MESSAGES.not_running);
        bridge = new Bridge(await stream(bridgeCommand(db.containerName, DATABASE_CATALOG[db.engine].port)));
        const creds = { user: db.username ?? '', password, database: db.databaseName ?? '' };
        const opened: Opened =
          db.engine === 'REDIS'
            ? { kind: 'redis', engine: await RedisEngine.connect(bridge.socket, password) }
            : { kind: 'sql', engine: db.engine === 'POSTGRES' ? await PostgresEngine.connect(bridge.socket, creds) : await MysqlEngine.connect(bridge.socket, creds) };
        try {
          return await fn(opened);
        } finally {
          await opened.engine.close();
        }
      });
    } catch (e) {
      throw this.explain(e, bridge, server.serverName);
    } finally {
      (bridge as Bridge | null)?.close();
    }
  }

  /** Why it failed, in words: ours (HTTP errors pass through), the bridge's limits, SSH, or the database's own error. */
  private explain(e: unknown, bridge: Bridge | null, serverName: string): Error {
    if (e instanceof HttpException) return e;
    if (bridge?.timedOut) return new BadRequestException(DATA_MESSAGES.timed_out);
    if (bridge?.tooBig) return new BadRequestException(DATA_MESSAGES.too_big);
    if (e instanceof SshError) return new BadGatewayException(DATA_MESSAGES.unreachable.replace('{server}', serverName));
    const err = e as { message?: string; code?: string; errno?: number };
    // pg: 57014 = canceled by statement_timeout; mysql2: 3024 = MAX_EXECUTION_TIME.
    if (err.code === '57014' || err.errno === 3024) return new BadRequestException(DATA_MESSAGES.timed_out);
    if (/terminated unexpectedly|connection lost|closed the connection|ECONNRESET|Connection is closed/i.test(err.message ?? '')) {
      return new BadGatewayException(DATA_MESSAGES.connection_lost.replace('{reason}', err.message ?? 'unknown'));
    }
    // The database refused it (bad SQL, a constraint, a type): its own message is the useful one.
    return new BadRequestException(err.message ?? String(e));
  }

  // ── audit ───────────────────────────────────────────────────────────────

  /** Admin's audit log only (no projectId): the text can hold values, and project Activity is visible to everyone. */
  private async recordQuery(actor: Actor, serviceId: string, text: string, wrote: boolean) {
    await this.audit.record(actor, {
      action: 'database.query_run',
      entityType: 'database',
      entityId: serviceId,
      metadata: { name: await this.name(serviceId), query: text.slice(0, 1000), allowedWrites: wrote },
    });
  }

  /** Also in the project's Activity: which table and how many rows, never the values. */
  private async recordChange(actor: Actor, serviceId: string, m: { table: string; change: string; rows: number; columns?: string; key?: string }) {
    const s = await this.prisma.client.service.findUnique({ where: { id: serviceId }, select: { serviceName: true, environment: { select: { projectId: true } } } });
    await this.audit.record(actor, {
      action: 'database.rows_changed',
      entityType: 'database',
      entityId: serviceId,
      metadata: { name: s?.serviceName ?? null, ...m },
      projectId: s?.environment.projectId,
    });
  }

  private async name(serviceId: string) {
    return (await this.prisma.client.service.findUnique({ where: { id: serviceId }, select: { serviceName: true } }))?.serviceName ?? null;
  }
}
