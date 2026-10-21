import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isIP } from 'node:net';
import type { BackupStorageKind } from 'db';
import type { BackupStorageStatus, SaveBackupStorageInput } from 'shared-types';
import { testConnection, type StorageTarget } from 'storage';
import { decrypt, encrypt } from 'warden-crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OrgKeyService } from '../warden-crypto/org-key.service';
import { BACKUP_MESSAGES } from '../../common/constants/messages.config';
import type { Actor } from '../../common/types/actor';

/**
 * Where an org's backups go: its own bucket if it set one (Settings → Backup
 * storage), else Warden's platform bucket from .env, else nowhere. The worker
 * has the same rule (apps/worker/src/backups/storage.ts).
 */
@Injectable()
export class BackupStorageService {
  private readonly platformTarget: StorageTarget | null;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly orgKeys: OrgKeyService,
    private readonly audit: AuditService,
  ) {
    const endpoint = config.get<string>('BACKUP_S3_ENDPOINT') ?? '';
    const bucket = config.get<string>('BACKUP_S3_BUCKET') ?? '';
    const accessKeyId = config.get<string>('BACKUP_S3_ACCESS_KEY_ID') ?? '';
    const secretAccessKey =
      config.get<string>('BACKUP_S3_SECRET_ACCESS_KEY') ?? '';
    this.platformTarget =
      endpoint && bucket && accessKeyId && secretAccessKey
        ? { endpoint, bucket, accessKeyId, secretAccessKey }
        : null;
  }

  /** Which storage a NEW backup would use. */
  async activeKind(orgId: string): Promise<'ORG' | 'PLATFORM' | 'NONE'> {
    const own = await this.prisma.client.backupStorage.findUnique({
      where: { organizationId: orgId },
      select: { id: true },
    });
    if (own) return 'ORG';
    return this.platformTarget ? 'PLATFORM' : 'NONE';
  }

  /** For an EXISTING backup: the storage it was written to, in its bucket. */
  async targetOf(
    orgId: string,
    kind: BackupStorageKind,
    bucket: string | null,
  ): Promise<StorageTarget | null> {
    const t = kind === 'ORG' ? await this.own(orgId) : this.platformTarget;
    return t && bucket ? { ...t, bucket } : t;
  }

  async status(orgId: string): Promise<BackupStorageStatus> {
    const row = await this.prisma.client.backupStorage.findUnique({
      where: { organizationId: orgId },
    });
    return {
      active: row ? 'ORG' : this.platformTarget ? 'PLATFORM' : 'NONE',
      own: row && {
        endpoint: row.endpoint,
        bucket: row.bucket,
        accessKeyId: row.accessKeyId,
        updatedAt: row.updatedAt.toISOString(),
      },
    };
  }

  /**
   * Save the org's own bucket, only after a test write to it worked, so a
   * typo shows up now and not at 2am when the first backup fails.
   */
  async save(
    actor: Actor,
    input: SaveBackupStorageInput,
  ): Promise<BackupStorageStatus> {
    const orgId = actor.organizationId;
    // The api and the worker make requests to this address, so it must not
    // point into Warden's own network (an IP address or a local-only name).
    const host = new URL(input.endpoint).hostname.toLowerCase();
    if (
      isIP(host.replace(/^\[|\]$/g, '')) ||
      host === 'localhost' ||
      !host.includes('.') ||
      /\.(local|internal|localhost|lan|home)$/.test(host)
    ) {
      throw new BadRequestException(BACKUP_MESSAGES.storage_private_host);
    }
    try {
      await testConnection(input);
    } catch (e) {
      const why = (e as Error).message.split('\n')[0].slice(0, 200);
      throw new BadRequestException(
        `${BACKUP_MESSAGES.storage_unreachable}: ${why}`,
      );
    }
    const secretEncrypted = encrypt(
      input.secretAccessKey,
      await this.orgKeys.getDek(orgId),
      'v1',
    );
    const data = {
      endpoint: input.endpoint,
      bucket: input.bucket,
      accessKeyId: input.accessKeyId,
      secretEncrypted,
    };
    await this.prisma.client.backupStorage.upsert({
      where: { organizationId: orgId },
      create: { organizationId: orgId, ...data },
      update: data,
    });
    await this.audit.record(actor, {
      action: 'backup_storage.updated',
      entityType: 'backup_storage',
      entityId: orgId,
      metadata: { endpoint: input.endpoint, bucket: input.bucket },
    });
    return this.status(orgId);
  }

  /**
   * Forget the org's own bucket. Backups already in it stay listed, but can't
   * be downloaded or restored until it's added back.
   */
  async remove(actor: Actor): Promise<BackupStorageStatus> {
    const orgId = actor.organizationId;
    const { count } = await this.prisma.client.backupStorage.deleteMany({
      where: { organizationId: orgId },
    });
    if (count) {
      await this.audit.record(actor, {
        action: 'backup_storage.removed',
        entityType: 'backup_storage',
        entityId: orgId,
      });
    }
    return this.status(orgId);
  }

  private async own(orgId: string): Promise<StorageTarget | null> {
    const row = await this.prisma.client.backupStorage.findUnique({
      where: { organizationId: orgId },
    });
    if (!row) return null;
    return {
      endpoint: row.endpoint,
      bucket: row.bucket,
      accessKeyId: row.accessKeyId,
      secretAccessKey: decrypt(row.secretEncrypted, {
        v1: await this.orgKeys.getDek(orgId),
      }),
    };
  }
}
