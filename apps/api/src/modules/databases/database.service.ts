import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { randomInt, randomUUID } from 'node:crypto';
import { Prisma, type ServiceDatabase } from 'db';
import {
  DATABASE_CATALOG,
  type CreateDatabaseInput,
  type DatabaseConnection,
  type DatabaseInfo,
  type DatabaseJob,
  type DeleteDatabaseInput,
  type Service,
  type UpdateBackupSettingsInput,
} from 'shared-types';
import { decrypt, encrypt } from 'warden-crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OrgKeyService } from '../warden-crypto/org-key.service';
import {
  DATABASE_MESSAGES,
  ENVIRONMENT_MESSAGES,
  SERVER_MESSAGES,
  SERVICE_MESSAGES,
} from '../../common/constants/messages.config';
import type { Actor } from '../../common/types/actor';
import { DATABASE_QUEUE } from './database.queue';
import { BackupStorageService } from './backup-storage.service';

/** A deploy that hasn't finished yet: a second create/restart must wait. */
const IN_PROGRESS = [
  'QUEUED',
  'BUILDING',
  'DEPLOYING',
  'HEALTH_CHECK',
] as const;

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
/**
 * 32 random letters and digits. Nothing a shell, a URL or an env file could
 * misread, so the password never needs escaping anywhere.
 */
function generatePassword(): string {
  let s = '';
  for (let i = 0; i < 32; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

/** First 8 hex characters of a uuid: short, unique enough, and shell-safe. */
const short = (id: string) => id.replace(/-/g, '').slice(0, 8);

/**
 * How other services reach the database: the host is the container's name
 * on the environment's private Docker network, never a public address.
 */
export function connectionString(db: {
  engine: ServiceDatabase['engine'];
  containerName: string;
  username: string | null;
  databaseName: string | null;
  password: string;
}): string {
  const port = DATABASE_CATALOG[db.engine].port;
  switch (db.engine) {
    case 'POSTGRES':
      return `postgresql://${db.username}:${db.password}@${db.containerName}:${port}/${db.databaseName}`;
    case 'MYSQL':
      return `mysql://${db.username}:${db.password}@${db.containerName}:${port}/${db.databaseName}`;
    case 'REDIS':
      return `redis://default:${db.password}@${db.containerName}:${port}`;
  }
}

/**
 * Databases as a service. The api decides and records; the worker does the
 * work on the server (see apps/worker/src/jobs/database.ts). Developer and up
 * have full permissions, including deleting data (decided 2026-10-21).
 */
@Injectable()
export class DatabaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgKeys: OrgKeyService,
    private readonly audit: AuditService,
    @Inject(DATABASE_QUEUE) private readonly queue: Queue,
    private readonly backupStorage: BackupStorageService,
  ) {}

  async create(actor: Actor, input: CreateDatabaseInput): Promise<Service> {
    const orgId = actor.organizationId;
    const db = this.prisma.client;
    const spec = DATABASE_CATALOG[input.engine];

    const [env, server, taken] = await Promise.all([
      db.environment.findFirst({
        where: { id: input.environmentId, organizationId: orgId },
        select: { id: true },
      }),
      db.server.findFirst({
        where: { id: input.serverId, organizationId: orgId },
        select: { id: true, serverType: true },
      }),
      db.environmentVariable.findFirst({
        where: { environmentId: input.environmentId, key: input.variableName },
        select: { id: true },
      }),
    ]);
    if (!env) throw new NotFoundException(ENVIRONMENT_MESSAGES.not_found);
    if (!server) throw new NotFoundException(SERVER_MESSAGES.not_found);
    if (server.serverType !== 'DEPLOY') {
      throw new BadRequestException(DATABASE_MESSAGES.build_server);
    }
    if (taken) throw new ConflictException(DATABASE_MESSAGES.variable_taken);

    // Everything the container needs, decided here so the worker only follows it.
    const serviceId = randomUUID();
    const password = generatePassword();
    const isRedis = input.engine === 'REDIS';
    const containerName = `warden-db-${short(serviceId)}`;
    const record = {
      engine: input.engine,
      version: input.version,
      databaseName: isRedis ? null : 'app',
      username: isRedis ? null : 'app',
      containerName,
      volumeName: `${containerName}-data`,
      networkName: `warden-env-${short(env.id)}`,
      variableName: input.variableName,
    };
    const dek = await this.orgKeys.getDek(orgId);
    const triggeredByName = await this.actorName(actor);

    let deploymentId: string;
    try {
      deploymentId = await db.$transaction(async (tx) => {
        await tx.service.create({
          data: {
            id: serviceId,
            serviceName: input.serviceName,
            type: 'DATABASE',
            status: 'DEPLOYING',
            image: `${spec.image}:${input.version}`,
            port: spec.port,
            environmentId: env.id,
            organizationId: orgId,
            serverId: server.id,
          },
        });
        const variable = await tx.environmentVariable.create({
          data: {
            environmentId: env.id,
            organizationId: orgId,
            key: input.variableName,
            valueEncrypted: encrypt(
              connectionString({ ...record, password }),
              dek,
              'v1',
            ),
            isSecret: true,
          },
        });
        await tx.serviceDatabase.create({
          data: {
            ...record,
            serviceId,
            organizationId: orgId,
            passwordEncrypted: encrypt(password, dek, 'v1'),
            rootPasswordEncrypted:
              input.engine === 'MYSQL'
                ? encrypt(generatePassword(), dek, 'v1')
                : null,
            environmentVariableId: variable.id,
          },
        });
        return this.newDeployment(tx, {
          orgId,
          serviceId,
          actor,
          triggeredByName,
          message: `Create ${spec.label} ${input.version} database`,
        });
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(SERVICE_MESSAGES.name_taken);
      }
      throw e;
    }

    await this.enqueue(
      { action: 'provision', serviceId, organizationId: orgId, deploymentId },
      deploymentId,
    );
    await this.audit.record(actor, {
      action: 'database.created',
      entityType: 'database',
      entityId: serviceId,
      metadata: {
        name: input.serviceName,
        engine: input.engine,
        version: input.version,
      },
      projectId: await this.projectOf(env.id),
    });
    return this.service(orgId, serviceId);
  }

  async info(orgId: string, serviceId: string): Promise<DatabaseInfo> {
    const row = await this.find(orgId, serviceId);
    const latest = await this.prisma.client.deployment.findFirst({
      where: { serviceId, organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      include: { history: { orderBy: { createdAt: 'asc' }, take: 30 } },
    });
    return {
      serviceId,
      engine: row.engine,
      version: row.version,
      databaseName: row.databaseName,
      username: row.username,
      host: row.containerName,
      port: DATABASE_CATALOG[row.engine].port,
      containerName: row.containerName,
      volumeName: row.volumeName,
      variableName: row.variableName,
      backup: {
        enabled: row.backupEnabled,
        hourUtc: row.backupHourUtc,
        retentionDays: row.backupRetentionDays,
        storage: await this.backupStorage.activeKind(orgId),
      },
      latestDeployment: latest && {
        id: latest.id,
        number: latest.number,
        status: latest.deploymentStatus,
        createdAt: latest.createdAt.toISOString(),
        finishedAt: latest.finishedAt?.toISOString() ?? null,
        history: latest.history.map((h) => ({
          status: h.status,
          message: h.message,
          at: h.createdAt.toISOString(),
        })),
      },
    };
  }

  /** Daily schedule and how long backups are kept. Pruning happens after the next backup. */
  async updateBackupSettings(
    actor: Actor,
    serviceId: string,
    input: UpdateBackupSettingsInput,
  ): Promise<DatabaseInfo> {
    const orgId = actor.organizationId;
    await this.find(orgId, serviceId);
    await this.prisma.client.serviceDatabase.update({
      where: { serviceId },
      data: {
        backupEnabled: input.enabled,
        backupHourUtc: input.hourUtc,
        backupRetentionDays: input.retentionDays,
      },
    });
    await this.audit.record(actor, {
      action: 'database.backup_settings_updated',
      entityType: 'database',
      entityId: serviceId,
      metadata: {
        name: (await this.service(orgId, serviceId)).serviceName,
        ...input,
      },
      projectId: await this.projectOfService(serviceId),
    });
    return this.info(orgId, serviceId);
  }

  async restart(actor: Actor, serviceId: string): Promise<Service> {
    const orgId = actor.organizationId;
    await this.find(orgId, serviceId);
    await this.assertIdle(orgId, serviceId);
    const triggeredByName = await this.actorName(actor);
    const deploymentId = await this.prisma.client.$transaction(async (tx) => {
      await tx.service.update({
        where: { id: serviceId },
        data: { status: 'DEPLOYING' },
      });
      return this.newDeployment(tx, {
        orgId,
        serviceId,
        actor,
        triggeredByName,
        message: 'Restart database',
      });
    });
    await this.enqueue(
      { action: 'restart', serviceId, organizationId: orgId, deploymentId },
      deploymentId,
    );
    await this.audit.record(actor, {
      action: 'database.restarted',
      entityType: 'database',
      entityId: serviceId,
      metadata: { name: (await this.service(orgId, serviceId)).serviceName },
      projectId: await this.projectOfService(serviceId),
    });
    return this.service(orgId, serviceId);
  }

  /**
   * Queue the removal. The data volume stays unless deleteData is set AND the
   * typed name matches. The worker deletes the rows once the container is gone.
   */
  async remove(
    actor: Actor,
    serviceId: string,
    input: DeleteDatabaseInput,
  ): Promise<void> {
    const orgId = actor.organizationId;
    await this.find(orgId, serviceId);
    const svc = await this.service(orgId, serviceId);
    if (input.deleteData && input.confirmName !== svc.serviceName) {
      throw new BadRequestException(DATABASE_MESSAGES.confirm_name);
    }
    await this.assertIdle(orgId, serviceId);
    await this.enqueue({
      action: 'remove',
      serviceId,
      organizationId: orgId,
      deleteData: input.deleteData,
    });
    await this.audit.record(actor, {
      action: 'database.deleted',
      entityType: 'database',
      entityId: serviceId,
      metadata: { name: svc.serviceName, dataDeleted: input.deleteData },
      projectId: await this.projectOfService(serviceId),
    });
  }

  /** The connection string, rebuilt from its parts. Audit-logged like a variable reveal. */
  async connection(
    actor: Actor,
    serviceId: string,
  ): Promise<DatabaseConnection> {
    const orgId = actor.organizationId;
    const row = await this.find(orgId, serviceId);
    const password = decrypt(row.passwordEncrypted, {
      v1: await this.orgKeys.getDek(orgId),
    });
    await this.audit.record(actor, {
      action: 'database.connection_revealed',
      entityType: 'database',
      entityId: serviceId,
      metadata: { variable: row.variableName },
      projectId: await this.projectOfService(serviceId),
    });
    return { connectionString: connectionString({ ...row, password }) };
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private async find(orgId: string, serviceId: string) {
    const row = await this.prisma.client.serviceDatabase.findFirst({
      where: { serviceId, organizationId: orgId },
    });
    if (!row) throw new NotFoundException(DATABASE_MESSAGES.not_found);
    return row;
  }

  async assertIdle(orgId: string, serviceId: string) {
    const busy = await this.prisma.client.deployment.findFirst({
      where: {
        serviceId,
        organizationId: orgId,
        deploymentStatus: { in: [...IN_PROGRESS] },
      },
      select: { id: true },
    });
    if (busy) throw new ConflictException(DATABASE_MESSAGES.busy);
  }

  /**
   * A Deployment row with the next per-org number. The counter is bumped
   * INSIDE the caller's transaction, so two deploys at the same moment can
   * never get the same #number: Postgres increments it atomically.
   */
  async newDeployment(
    tx: Prisma.TransactionClient,
    d: {
      orgId: string;
      serviceId: string;
      actor: Actor;
      triggeredByName: string | null;
      message: string;
    },
  ): Promise<string> {
    const { deployCounter } = await tx.organization.update({
      where: { id: d.orgId },
      data: { deployCounter: { increment: 1 } },
      select: { deployCounter: true },
    });
    const dep = await tx.deployment.create({
      data: {
        number: deployCounter,
        organizationId: d.orgId,
        serviceId: d.serviceId,
        deploymentStatus: 'QUEUED',
        commitMessage: d.message,
        triggeredById: d.actor.userId,
        triggeredByName: d.triggeredByName,
        history: { create: { status: 'QUEUED', message: 'Queued' } },
      },
    });
    return dep.id;
  }

  private async enqueue(job: DatabaseJob, deploymentId?: string) {
    try {
      await this.queue.add(`database-${job.action}`, job);
    } catch {
      if (deploymentId) {
        await this.prisma.client.deployment.update({
          where: { id: deploymentId },
          data: {
            deploymentStatus: 'FAILED',
            finishedAt: new Date(),
            history: {
              create: { status: 'FAILED', message: 'Could not queue the job' },
            },
          },
        });
        await this.prisma.client.service.update({
          where: { id: job.serviceId },
          data: { status: 'FAILED' },
        });
      }
      throw new ServiceUnavailableException(DATABASE_MESSAGES.not_queued);
    }
  }

  async actorName(actor: Actor): Promise<string | null> {
    if (actor.userId) {
      const u = await this.prisma.client.user.findUnique({
        where: { id: actor.userId },
        select: { firstName: true, lastName: true },
      });
      return u ? `${u.firstName} ${u.lastName}`.trim() : null;
    }
    if (actor.apiTokenId) {
      const t = await this.prisma.client.apiToken.findUnique({
        where: { id: actor.apiTokenId },
        select: { apiName: true },
      });
      return t ? `token: ${t.apiName}` : null;
    }
    return null;
  }

  async service(orgId: string, serviceId: string): Promise<Service> {
    const s = await this.prisma.client.service.findFirstOrThrow({
      where: { id: serviceId, organizationId: orgId },
    });
    return {
      id: s.id,
      serviceName: s.serviceName,
      type: s.type,
      status: s.status,
      githubRepoUrl: s.githubRepoUrl,
      branch: s.branch,
      port: s.port,
      image: s.image,
      environmentId: s.environmentId,
      serverId: s.serverId,
      canvasX: s.canvasX,
      canvasY: s.canvasY,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }

  private async projectOf(environmentId: string) {
    const env = await this.prisma.client.environment.findUnique({
      where: { id: environmentId },
      select: { projectId: true },
    });
    return env?.projectId;
  }

  async projectOfService(serviceId: string) {
    const s = await this.prisma.client.service.findUnique({
      where: { id: serviceId },
      select: { environment: { select: { projectId: true } } },
    });
    return s?.environment.projectId;
  }
}
