import { z } from "zod";

/*
 * Server monitoring (1G): what the worker collects, what the api serves, and
 * the BullMQ job payloads that cross from api to worker.
 */

// ── queues ──────────────────────────────────────────────────

/** BullMQ queue names, shared so the api's producer and the worker agree. */
export const QUEUES = {
  /** Worker-internal: the 60s tick, one collect job per server, the hourly prune. */
  monitoring: "monitoring",
  /** Enqueued by the api when someone presses Run cleanup. */
  cleanup: "docker-cleanup",
} as const;

export const MONITORING_JOBS = {
  tick: "metrics-tick",
  collect: "collect-server",
  prune: "prune-metrics",
} as const;

export const CollectServerJobSchema = z.object({ serverId: z.uuid() });
export type CollectServerJob = z.infer<typeof CollectServerJobSchema>;

export const CleanupJobSchema = z.object({
  cleanupId: z.uuid(),
  serverId: z.uuid(),
  organizationId: z.uuid(),
});
export type CleanupJob = z.infer<typeof CleanupJobSchema>;

// ── metrics ─────────────────────────────────────────────────

/** Percentages over the window: the latest reading, the highest, the average. */
const UsageStatSchema = z.object({
  current: z.number(),
  peak: z.number(),
  avg: z.number(),
});
const ByteUsageStatSchema = UsageStatSchema.extend({
  usedBytes: z.number(),
  totalBytes: z.number(),
});

export const MetricPointSchema = z.object({
  at: z.iso.datetime(),
  cpu: z.number(),
  memory: z.number(),
  disk: z.number(),
});
export type MetricPoint = z.infer<typeof MetricPointSchema>;

export const DockerDiskUsageSchema = z.object({
  collectedAt: z.iso.datetime(),
  images: z.number(),
  containers: z.number(),
  volumes: z.number(),
  buildCache: z.number(),
  total: z.number(),
  reclaimable: z.number(),
});
export type DockerDiskUsage = z.infer<typeof DockerDiskUsageSchema>;

/** GET /server-metrics?serverId= : the Resources tab. Nulls until the first poll lands. */
export const ServerMetricsSchema = z.object({
  windowHours: z.number().int(),
  collectedAt: z.iso.datetime().nullable(),
  cpu: UsageStatSchema.nullable(),
  memory: ByteUsageStatSchema.nullable(),
  disk: ByteUsageStatSchema.nullable(),
  load: z.object({ one: z.number(), five: z.number(), fifteen: z.number() }).nullable(),
  /** 5-minute averages, oldest first. */
  points: z.array(MetricPointSchema),
  docker: DockerDiskUsageSchema.nullable(),
});
export type ServerMetrics = z.infer<typeof ServerMetricsSchema>;

/** The latest reading, shown on each server card. */
export const ServerUsageSchema = z.object({
  cpu: z.number(),
  memory: z.number(),
  disk: z.number(),
  at: z.iso.datetime(),
});
export type ServerUsage = z.infer<typeof ServerUsageSchema>;

// ── containers ──────────────────────────────────────────────

export const ContainerHealthSchema = z.enum(["healthy", "unhealthy", "starting"]);

export const ServerContainerSchema = z.object({
  id: z.string(),
  /** Docker's short id (12 characters). */
  dockerId: z.string(),
  name: z.string(),
  image: z.string(),
  /** running, exited, restarting, paused, created, dead */
  state: z.string(),
  health: ContainerHealthSchema.nullable(),
  statusText: z.string(),
  cpu: z.number().nullable(),
  memoryBytes: z.number().nullable(),
  memoryLimitBytes: z.number().nullable(),
});
export type ServerContainer = z.infer<typeof ServerContainerSchema>;

/** GET /server-containers?serverId= */
export const ServerContainerListSchema = z.object({
  collectedAt: z.iso.datetime().nullable(),
  items: z.array(ServerContainerSchema),
});
export type ServerContainerList = z.infer<typeof ServerContainerListSchema>;

// ── cleanup ─────────────────────────────────────────────────

export const CleanupCategoryKeySchema = z.enum(["containers", "images", "buildCache", "networks"]);
export type CleanupCategoryKey = z.infer<typeof CleanupCategoryKeySchema>;

/** GET /docker-cleanups/preview?serverId= : asked live over SSH. */
export const CleanupPreviewSchema = z.object({
  categories: z.array(
    z.object({
      key: CleanupCategoryKeySchema,
      count: z.number().int(),
      /** Networks take no disk space, so null. */
      bytes: z.number().nullable(),
    }),
  ),
  totalBytes: z.number(),
});
export type CleanupPreview = z.infer<typeof CleanupPreviewSchema>;

export const CleanupStatusSchema = z.enum(["QUEUED", "RUNNING", "SUCCESS", "FAILED"]);
export type CleanupStatus = z.infer<typeof CleanupStatusSchema>;

export const DockerCleanupSchema = z.object({
  id: z.string(),
  serverId: z.string(),
  status: CleanupStatusSchema,
  reclaimedBytes: z.number().nullable(),
  errorMessage: z.string().nullable(),
  /** Null when Warden started it, or the person has since been deleted. */
  triggeredBy: z.string().nullable(),
  createdAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
});
export type DockerCleanup = z.infer<typeof DockerCleanupSchema>;

/** POST /docker-cleanups */
export const StartCleanupSchema = z.object({ serverId: z.uuid("Pick a server") });
export type StartCleanupInput = z.infer<typeof StartCleanupSchema>;
