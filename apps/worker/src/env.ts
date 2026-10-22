import "dotenv/config";
import { z } from "zod";

/**
 * Everything the worker reads from its environment, checked once at boot so
 * a typo fails loudly instead of halfway through a job. DATABASE_URL, REDIS_URL
 * and MASTER_KEY must match the api's.
 */
const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  MASTER_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, "MASTER_KEY must be 64 hex characters (openssl rand -hex 32)"),
  /** The dashboard's address, for "View server" links in alerts. Empty = no link. */
  APP_URL: z.string().default(""),
  RESEND_API_KEY: z.string().default(""),
  MAIL_FROM: z.string().default("noreply@oluwatobii.xyz"),
  MONITOR_INTERVAL_SECONDS: z.coerce.number().int().min(15).default(60),
  /** Raw metric rows older than this are deleted. The UI shows 24h. */
  METRICS_RETENTION_DAYS: z.coerce.number().int().min(1).default(7),
  DISK_HIGH_PERCENT: z.coerce.number().min(50).max(99).default(90),
  /** Servers polled at the same time. */
  MONITOR_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(10),
  /** true: log alerts instead of sending them (local testing). */
  NOTIFY_DRY_RUN: z.stringbool().default(false),
  /**
   * Warden's own bucket for database backups (Cloudflare R2 in production,
   * infra's s3-local in dev). Empty = only orgs with their own bucket get
   * backups. Must match the api's.
   */
  BACKUP_S3_ENDPOINT: z.string().default(""),
  BACKUP_S3_BUCKET: z.string().default(""),
  BACKUP_S3_ACCESS_KEY_ID: z.string().default(""),
  BACKUP_S3_SECRET_ACCESS_KEY: z.string().default(""),
  /**
   * The Warden GitHub App (private repos). Empty = public repos only. Must
   * match the api's. The private key may be written on one line with \n.
   */
  GITHUB_APP_ID: z.string().default(""),
  GITHUB_APP_PRIVATE_KEY: z.string().default(""),
  GITHUB_APP_WEBHOOK_SECRET: z.string().default(""),
  GITHUB_APP_SLUG: z.string().default(""),
});

function load() {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid worker environment:\n${issues}`);
  }
  return parsed.data;
}

export const env = load();
