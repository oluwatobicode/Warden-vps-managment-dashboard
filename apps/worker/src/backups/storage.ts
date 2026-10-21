import { prisma, type BackupStorageKind } from "db";
import type { StorageTarget } from "storage";
import { env } from "../env";
import { unseal } from "../keys";

/*
 * Where an org's backups go: its own bucket if it set one, else Warden's
 * platform bucket from .env, else nowhere. The api has the same rule.
 */

function platform(): StorageTarget | null {
  const e = env;
  if (!e.BACKUP_S3_ENDPOINT || !e.BACKUP_S3_BUCKET || !e.BACKUP_S3_ACCESS_KEY_ID || !e.BACKUP_S3_SECRET_ACCESS_KEY) return null;
  return { endpoint: e.BACKUP_S3_ENDPOINT, bucket: e.BACKUP_S3_BUCKET, accessKeyId: e.BACKUP_S3_ACCESS_KEY_ID, secretAccessKey: e.BACKUP_S3_SECRET_ACCESS_KEY };
}

async function own(orgId: string): Promise<StorageTarget | null> {
  const row = await prisma.backupStorage.findUnique({ where: { organizationId: orgId } });
  if (!row) return null;
  return { endpoint: row.endpoint, bucket: row.bucket, accessKeyId: row.accessKeyId, secretAccessKey: await unseal(orgId, row.secretEncrypted) };
}

/** For a NEW backup. */
export async function activeStorage(orgId: string): Promise<{ kind: BackupStorageKind; target: StorageTarget } | null> {
  const o = await own(orgId);
  if (o) return { kind: "ORG", target: o };
  const p = platform();
  return p ? { kind: "PLATFORM", target: p } : null;
}

/** For an EXISTING backup: the storage it was written to, in the bucket recorded on it. */
export async function storageOf(orgId: string, kind: BackupStorageKind, bucket: string | null): Promise<StorageTarget | null> {
  const t = kind === "ORG" ? await own(orgId) : platform();
  return t && bucket ? { ...t, bucket } : t;
}
