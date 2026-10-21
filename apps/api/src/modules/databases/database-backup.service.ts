import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  StreamableFile,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { DatabaseBackup as BackupRow } from 'db';
import {
  BACKUP_JOBS,
  type BackupJob,
  type DatabaseBackup,
  type RestoreBackupInput,
  type Service,
} from 'shared-types';
import { decryptStream, downloadStream } from 'storage';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OrgKeyService } from '../warden-crypto/org-key.service';
import {
  BACKUP_MESSAGES,
  DATABASE_MESSAGES,
} from '../../common/constants/messages.config';
import type { Actor } from '../../common/types/actor';
import { BackupStorageService } from './backup-storage.service';
import { DatabaseService } from './database.service';
import { BACKUP_QUEUE } from './database.queue';

/** Running or waiting: a second backup or a restore must wait for it. */
const BUSY = ['QUEUED', 'RUNNING'] as const;

const toDto = (b: BackupRow): DatabaseBackup => ({
  id: b.id,
  serviceId: b.serviceId,
  status: b.status,
  trigger: b.trigger,
  storage: b.storage,
  sizeBytes: b.sizeBytes,
  error: b.error,
  createdAt: b.createdAt.toISOString(),
  finishedAt: b.finishedAt?.toISOString() ?? null,
});

/**
 * Database backups: list, back up now, restore, download. The worker does
 * the dumping and restoring (apps/worker/src/jobs/backup.ts); the api only
 * decides, records and queues, except for downloads, which it streams itself
 * (the file is decrypted on the way out, never stored decrypted).
 */
@Injectable()
export class DatabaseBackupService {
  private readonly logger = new Logger(DatabaseBackupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orgKeys: OrgKeyService,
    private readonly audit: AuditService,
    private readonly storage: BackupStorageService,
    private readonly databases: DatabaseService,
    @Inject(BACKUP_QUEUE) private readonly queue: Queue,
  ) {}

  async list(orgId: string, serviceId: string): Promise<DatabaseBackup[]> {
    await this.findDatabase(orgId, serviceId);
    const rows = await this.prisma.client.databaseBackup.findMany({
      where: { serviceId, organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map(toDto);
  }

  async backupNow(actor: Actor, serviceId: string): Promise<DatabaseBackup> {
    const orgId = actor.organizationId;
    await this.findDatabase(orgId, serviceId);
    const svc = await this.databases.service(orgId, serviceId);
    if (svc.status !== 'HEALTHY' && svc.status !== 'DEGRADED') {
      throw new ConflictException(BACKUP_MESSAGES.not_running);
    }
    await this.assertNoBackupRunning(orgId, serviceId);
    await this.databases.assertIdle(orgId, serviceId);
    const kind = await this.storage.activeKind(orgId);
    if (kind === 'NONE') {
      throw new BadRequestException(BACKUP_MESSAGES.no_storage);
    }
    const row = await this.prisma.client.databaseBackup.create({
      data: {
        serviceId,
        organizationId: orgId,
        trigger: 'MANUAL',
        storage: kind,
      },
    });
    await this.enqueue(
      { action: 'backup', backupId: row.id, serviceId, organizationId: orgId },
      async () => {
        await this.prisma.client.databaseBackup.update({
          where: { id: row.id },
          data: {
            status: 'FAILED',
            error: 'Could not queue the job',
            finishedAt: new Date(),
          },
        });
      },
    );
    return toDto(row);
  }

  /**
   * Overwrite the database's data with a backup. Logged as a deployment, like
   * a restart, and the name must be typed: there's no undo (except restoring
   * a newer backup, so take one first if the current data matters).
   */
  async restore(
    actor: Actor,
    backupId: string,
    input: RestoreBackupInput,
  ): Promise<Service> {
    const orgId = actor.organizationId;
    const b = await this.findBackup(orgId, backupId);
    if (b.status !== 'SUCCESS' || !b.objectKey) {
      throw new BadRequestException(BACKUP_MESSAGES.not_restorable);
    }
    const svc = await this.databases.service(orgId, b.serviceId);
    if (input.confirmName !== svc.serviceName) {
      throw new BadRequestException(BACKUP_MESSAGES.confirm_name);
    }
    if (!(await this.storage.targetOf(orgId, b.storage, b.bucket))) {
      throw new BadRequestException(BACKUP_MESSAGES.storage_missing);
    }
    await this.assertNoBackupRunning(orgId, b.serviceId);
    await this.databases.assertIdle(orgId, b.serviceId);

    const triggeredByName = await this.databases.actorName(actor);
    const when = b.createdAt.toISOString().replace('T', ' ').slice(0, 16);
    const deploymentId = await this.prisma.client.$transaction(async (tx) => {
      await tx.service.update({
        where: { id: b.serviceId },
        data: { status: 'DEPLOYING' },
      });
      return this.databases.newDeployment(tx, {
        orgId,
        serviceId: b.serviceId,
        actor,
        triggeredByName,
        message: `Restore backup from ${when} UTC`,
      });
    });
    await this.enqueue(
      {
        action: 'restore',
        backupId,
        serviceId: b.serviceId,
        organizationId: orgId,
        deploymentId,
      },
      async () => {
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
          where: { id: b.serviceId },
          data: { status: 'HEALTHY' },
        });
      },
    );
    await this.audit.record(actor, {
      action: 'database.backup_restored',
      entityType: 'database',
      entityId: b.serviceId,
      metadata: { name: svc.serviceName, backupId, backupFrom: when },
      projectId: await this.databases.projectOfService(b.serviceId),
    });
    return this.databases.service(orgId, b.serviceId);
  }

  /**
   * The backup as the engine's own file (pg_dump custom format, .sql.gz or
   * .rdb.gz), decrypted while it streams. If the file was tampered with, the
   * check fails at the very end and the download breaks off, so a broken file
   * never looks like a finished one.
   */
  async download(actor: Actor, backupId: string): Promise<StreamableFile> {
    const orgId = actor.organizationId;
    const b = await this.findBackup(orgId, backupId);
    if (b.status !== 'SUCCESS' || !b.objectKey || !b.iv || !b.authTag) {
      throw new BadRequestException(BACKUP_MESSAGES.not_restorable);
    }
    const target = await this.storage.targetOf(orgId, b.storage, b.bucket);
    if (!target) throw new BadRequestException(BACKUP_MESSAGES.storage_missing);
    const svc = await this.databases.service(orgId, b.serviceId);

    const source = await downloadStream(target, b.objectKey);
    const decrypt = decryptStream(
      await this.orgKeys.getDek(orgId),
      b.iv,
      b.authTag,
    );
    // pipeline gives every stream an error handler: a failed check must
    // break this one download, never crash the api.
    // It starts only once Nest pipes `out` to the response ('resume'), when
    // Nest's error listener is attached: a small file can fail its check
    // sooner than that, and the error would be missed.
    const out = new PassThrough();
    out.once('resume', () => {
      pipeline(source, decrypt, out).catch((e: Error) =>
        this.logger.warn(`backup ${b.id} download stopped: ${e.message}`),
      );
    });

    // .../2026-10-21T02-00-00-123Z.sql.gz.enc → "sql.gz"
    const ext = b.objectKey
      .split('/')
      .pop()!
      .replace(/\.enc$/, '')
      .split('.')
      .slice(1)
      .join('.');
    const stamp = b.createdAt.toISOString().slice(0, 16).replace(/[:T]/g, '-');
    await this.audit.record(actor, {
      action: 'database.backup_downloaded',
      entityType: 'database',
      entityId: b.serviceId,
      metadata: { name: svc.serviceName, backupId },
      projectId: await this.databases.projectOfService(b.serviceId),
    });
    return new StreamableFile(out, {
      type: 'application/octet-stream',
      disposition: `attachment; filename="${svc.serviceName.replace(/[^\w.-]/g, '_')}-${stamp}.${ext}"`,
    }).setErrorHandler((_err, res) => {
      // Cut the connection rather than end it cleanly, so the browser shows
      // a failed download instead of a short file that looks finished.
      (res as unknown as { destroy(): void }).destroy();
    });
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private async findDatabase(orgId: string, serviceId: string) {
    const row = await this.prisma.client.serviceDatabase.findFirst({
      where: { serviceId, organizationId: orgId },
      select: { serviceId: true },
    });
    if (!row) throw new NotFoundException(DATABASE_MESSAGES.not_found);
  }

  private async findBackup(orgId: string, id: string) {
    const b = await this.prisma.client.databaseBackup.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!b) throw new NotFoundException(BACKUP_MESSAGES.not_found);
    return b;
  }

  private async assertNoBackupRunning(orgId: string, serviceId: string) {
    const busy = await this.prisma.client.databaseBackup.findFirst({
      where: { serviceId, organizationId: orgId, status: { in: [...BUSY] } },
      select: { id: true },
    });
    if (busy) throw new ConflictException(BACKUP_MESSAGES.in_progress);
  }

  private async enqueue(job: BackupJob, onFail: () => Promise<void>) {
    try {
      await this.queue.add(BACKUP_JOBS.run, job);
    } catch {
      await onFail();
      throw new ServiceUnavailableException(DATABASE_MESSAGES.not_queued);
    }
  }
}
