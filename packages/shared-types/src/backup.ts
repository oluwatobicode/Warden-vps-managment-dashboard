import { z } from "zod";

/*
 * Database backups (item 18b). Dumps are encrypted with the org's key before
 * they leave the worker, and stored in S3-compatible storage: Warden's own
 * bucket (Cloudflare R2, from .env) by default, or the org's own bucket if it
 * set one in Settings → Backup storage.
 */

export const BackupStatusSchema = z.enum(["QUEUED", "RUNNING", "SUCCESS", "FAILED"]);
export type BackupStatus = z.infer<typeof BackupStatusSchema>;
export const BackupTriggerSchema = z.enum(["SCHEDULED", "MANUAL"]);
export const BackupStorageKindSchema = z.enum(["PLATFORM", "ORG"]);
export type BackupStorageKind = z.infer<typeof BackupStorageKindSchema>;

export const DatabaseBackupSchema = z.object({
  id: z.string(),
  serviceId: z.string(),
  status: BackupStatusSchema,
  trigger: BackupTriggerSchema,
  storage: BackupStorageKindSchema,
  sizeBytes: z.number().nullable(),
  error: z.string().nullable(),
  createdAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
});
export type DatabaseBackup = z.infer<typeof DatabaseBackupSchema>;

/** Where this org's backups go right now. */
export const BackupStorageStatusSchema = z.object({
  /** ORG = its own bucket, PLATFORM = Warden's, NONE = nothing set up anywhere. */
  active: z.enum(["ORG", "PLATFORM", "NONE"]),
  /** The org's own bucket, if it set one. The secret is never returned. */
  own: z
    .object({ endpoint: z.string(), bucket: z.string(), accessKeyId: z.string(), updatedAt: z.iso.datetime() })
    .nullable(),
});
export type BackupStorageStatus = z.infer<typeof BackupStorageStatusSchema>;

/** PUT /backup-storage : the org's own S3-compatible bucket (e.g. its own Cloudflare R2). */
export const SaveBackupStorageSchema = z.object({
  endpoint: z
    .string()
    .trim()
    .url("Enter the full endpoint, e.g. https://<account-id>.r2.cloudflarestorage.com")
    .refine((u) => u.startsWith("https://"), "The endpoint must use https://"),
  bucket: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, "Use a bucket name: 3–63 lowercase letters, digits, dots or dashes"),
  accessKeyId: z.string().trim().min(8, "Paste the access key ID").max(200),
  secretAccessKey: z.string().trim().min(16, "Paste the secret access key").max(400),
});
export type SaveBackupStorageInput = z.infer<typeof SaveBackupStorageSchema>;

/** PATCH /databases/:serviceId/backup-settings */
export const UpdateBackupSettingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    /** Hour of the day, in UTC (the UI converts to local time). */
    hourUtc: z.number().int().min(0).max(23).optional(),
    retentionDays: z.number({ error: "Enter a number of days" }).int("Whole days").min(1, "At least 1 day").max(365, "At most 365 days").optional(),
  })
  .refine((v) => v.enabled !== undefined || v.hourUtc !== undefined || v.retentionDays !== undefined, { message: "Nothing to update" });
export type UpdateBackupSettingsInput = z.infer<typeof UpdateBackupSettingsSchema>;

export const BackupSettingsSchema = z.object({
  enabled: z.boolean(),
  hourUtc: z.number().int(),
  retentionDays: z.number().int(),
  storage: z.enum(["ORG", "PLATFORM", "NONE"]),
});
export type BackupSettings = z.infer<typeof BackupSettingsSchema>;

/** POST /database-backups/:id/restore : overwrites the current data. */
export const RestoreBackupSchema = z.object({ confirmName: z.string().trim().min(1, "Type the database name to confirm") });
export type RestoreBackupInput = z.infer<typeof RestoreBackupSchema>;

/** BullMQ payload, api → worker (and the worker's own scheduler). */
export const BackupJobSchema = z.object({
  action: z.enum(["backup", "restore"]),
  backupId: z.uuid(),
  serviceId: z.uuid(),
  organizationId: z.uuid(),
  /** restore: the deployment row that logs it. */
  deploymentId: z.uuid().optional(),
});
export type BackupJob = z.infer<typeof BackupJobSchema>;

export const BACKUP_JOBS = { tick: "backup-tick", run: "backup-run" } as const;
