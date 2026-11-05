import { z } from "zod";
import { ApiTokenScopeSchema } from "./api-token.js";
import { DeploymentStatusSchema } from "./dashboard.js";
import { BuildMethodSchema } from "./deploy.js";
import { DatabaseEngineSchema } from "./database.js";
import { ServerStatusSchema } from "./server.js";
import { ServiceStatusSchema, ServiceTypeSchema } from "./service.js";

/*
 * Platform admin (/platform): the one view across EVERY org, for the platform
 * owner only (User.platformRole = OWNER, set by hand in the database). Counts
 * and metadata only: no IPs, repo URLs, commits, variables, logs or secrets.
 * Relaxed by the owner on 2026-11-05 for exactly three things: people's names,
 * per-user deploy counts, and ONE email at a time through a logged reveal
 * (POST /platform/users/:id/email, a PlatformAccessLog row per call).
 */

const count = z.number().int().nonnegative();
const AuthProviderSchema = z.enum(["EMAIL", "GITHUB", "GOOGLE"]);

/** Where the health tab turns red. */
export const PLATFORM_LIMITS = {
  /** The worker polls every server every 60 s; silent this long = its loop is down. */
  workerSilentMs: 3 * 60 * 1000,
  /** Warden's own Postgres (the EC2 disk is small). */
  postgresWarnBytes: 10_000_000_000,
} as const;

/** One point of a per-day chart: the UTC day (YYYY-MM-DD) and its count. */
export const DayCountSchema = z.object({ day: z.string(), count });
export type DayCount = z.infer<typeof DayCountSchema>;

// ── GET /platform/overview ──────────────────────────────────

export const FUNNEL_STEPS = [
  "orgCreated",
  "sshKey",
  "server",
  "serverReachable",
  "project",
  "deployment",
  "successDeploy",
] as const;
export const FunnelStepSchema = z.enum(FUNNEL_STEPS);
export type FunnelStep = z.infer<typeof FunnelStepSchema>;

export const FUNNEL_STEP_LABEL: Record<FunnelStep, string> = {
  orgCreated: "Org created",
  sshKey: "Added an SSH key",
  server: "Added a server",
  serverReachable: "Server ever reachable",
  project: "Created a project",
  deployment: "Started a deploy",
  successDeploy: "Deploy succeeded",
};

export const PlatformOverviewSchema = z.object({
  growth: z.object({
    users: z.object({ total: count, new7d: count, new30d: count }),
    signupsByProvider: z.record(AuthProviderSchema, count),
    orgs: z.object({ total: count, new7d: count, new30d: count }),
    /** Distinct people with a membership active within 1 / 7 / 30 days. */
    activeUsers: z.object({ d1: count, d7: count, d30: count }),
    /** Orgs by ACTIVE members: exactly one vs two or more. */
    teamSize: z.object({ solo: count, team: count }),
    /** No member active and no deploy in 30 days. */
    dormantOrgs: count,
    /** Oldest lastActiveAt anywhere: before ~30 days of tracking, every older org looks dormant. */
    activityTrackedSince: z.iso.datetime().nullable(),
    deletedOrgs: z.object({ last30d: count, total: count, everDeployedOk: count }),
    invitations: z.object({ pending: count, accepted: count }),
    /** 30 points, oldest first, days without signups included as 0. */
    signupsPerDay: z.array(DayCountSchema),
  }),
  funnel: z.object({
    /** In FUNNEL_STEPS order: orgs that reached each step. */
    steps: z.array(z.object({ step: FunnelStepSchema, orgs: count })),
    /** Org created → its first SUCCESS deploy, median over orgs that got there. */
    medianSecondsToFirstSuccess: z.number().nullable(),
  }),
  deploys: z.object({
    total: count,
    last7d: count,
    last30d: count,
    perDay: z.array(DayCountSchema),
    /** Everything below: deploys created in the last 30 days. */
    byStatus: z.record(DeploymentStatusSchema, count),
    /** SUCCESS ÷ (SUCCESS + FAILED + GATE_FAILED + ROLLED_BACK). CANCELLED is left out: someone chose it. Null = none finished. */
    successRate: z.number().nullable(),
    /** startedAt → finishedAt of finished deploys. */
    durationSeconds: z.object({ p50: z.number().nullable(), p95: z.number().nullable() }),
    byBuildMethod: z.record(BuildMethodSchema, count),
    byType: z.object({ MANUAL: count, AUTOMATED: count }),
    rollbacks: count,
    /** Started with an API token (CI). */
    byApiToken: count,
  }),
  infra: z.object({
    serversByStatus: z.record(ServerStatusSchema, count),
    /** OFFLINE and not seen for 24 h (or never). */
    serversOfflineOver24h: count,
    /** Lower-cased and trimmed, top 10, the rest as "other"; no label = "unknown". */
    serversByProvider: z.array(z.object({ provider: z.string(), count })),
    proxy: z.object({ installed: count, notInstalled: count }),
    servicesByType: z.record(ServiceTypeSchema, count),
    servicesByStatus: z.record(ServiceStatusSchema, count),
    databases: z.array(z.object({ engine: DatabaseEngineSchema, version: z.string(), count })),
    backups30d: z.object({ success: count, failed: count }),
    /** Bytes of successful backups still recorded, per bucket kind. PLATFORM is Warden's bill. */
    backupBytes: z.object({ platform: z.number(), org: z.number() }),
    orgsWithOwnStorage: count,
    githubInstallations: count,
    customDomains: count,
    apiTokens: z.object({ total: count, byScope: z.record(ApiTokenScopeSchema, count) }),
  }),
  generatedAt: z.iso.datetime(),
});
export type PlatformOverview = z.infer<typeof PlatformOverviewSchema>;

// ── GET /platform/orgs ──────────────────────────────────────

export const PLATFORM_ORG_SORTS = ["created", "lastActive", "deploys30d"] as const;
export const PlatformOrgSortSchema = z.enum(PLATFORM_ORG_SORTS);
export type PlatformOrgSort = z.infer<typeof PlatformOrgSortSchema>;
export const PLATFORM_ORGS_PAGE = 50;

export const PlatformOrgsQuerySchema = z.object({
  sort: PlatformOrgSortSchema.default("created"),
  /** Opaque, from the previous page's nextCursor. */
  cursor: z.string().max(200).optional(),
});
export type PlatformOrgsQuery = z.infer<typeof PlatformOrgsQuerySchema>;

export const PlatformOrgRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.iso.datetime(),
  /** ACTIVE memberships. */
  members: count,
  lastActiveAt: z.iso.datetime().nullable(),
  servers: count,
  serversOffline: count,
  projects: count,
  services: count,
  deploys30d: count,
  lastDeployAt: z.iso.datetime().nullable(),
  everDeployedOk: z.boolean(),
  backupStorage: z.enum(["platform", "own"]),
});
export type PlatformOrgRow = z.infer<typeof PlatformOrgRowSchema>;

export const PlatformOrgPageSchema = z.object({
  items: z.array(PlatformOrgRowSchema),
  nextCursor: z.string().nullable(),
});
export type PlatformOrgPage = z.infer<typeof PlatformOrgPageSchema>;

// ── GET /platform/health ────────────────────────────────────

export const PlatformHealthSchema = z.object({
  postgres: z.object({
    sizeBytes: z.number(),
    /** The big time-series tables. Rows are Postgres's estimate (null = never analysed). */
    tables: z.array(z.object({ name: z.string(), sizeBytes: z.number(), approxRows: z.number().nullable() })),
  }),
  queues: z.array(
    z.object({ name: z.string(), waiting: count, active: count, failed: count, delayed: count }),
  ),
  worker: z.object({
    servers: count,
    /** Newest ServerMetrics row: the worker's 60 s monitoring loop wrote it. */
    lastMetricsAt: z.iso.datetime().nullable(),
    /** ok, silent (servers exist but no metrics for 3 min), or no-servers (nothing to poll). */
    state: z.enum(["ok", "silent", "no-servers"]),
  }),
  logCollector: z.object({ leases: count, servers: count }),
  redis: z.object({ usedMemoryBytes: z.number(), maxMemoryBytes: z.number().nullable() }),
  generatedAt: z.iso.datetime(),
});
export type PlatformHealth = z.infer<typeof PlatformHealthSchema>;

// ── deploys list (GET /platform/deploys) and per-user pages ─

export const PLATFORM_DEPLOY_FILTERS = ["all", "failed", "succeeded"] as const;
export const PlatformDeployFilterSchema = z.enum(PLATFORM_DEPLOY_FILTERS);
export type PlatformDeployFilter = z.infer<typeof PlatformDeployFilterSchema>;
export const PLATFORM_DEPLOYS_PAGE = 50;
/** How many of a user's newest deploys their page shows. */
export const PLATFORM_USER_RECENT_DEPLOYS = 25;

export const PlatformDeploysQuerySchema = z.object({
  /** failed = FAILED + GATE_FAILED, succeeded = SUCCESS. */
  status: PlatformDeployFilterSchema.default("all"),
  cursor: z.string().max(200).optional(),
});
export type PlatformDeploysQuery = z.infer<typeof PlatformDeploysQuerySchema>;

/** The pipeline step a failed deploy was in. */
export const FailedStepSchema = z.enum(["QUEUED", "BUILDING", "DEPLOYING", "HEALTH_CHECK"]);
export type FailedStep = z.infer<typeof FailedStepSchema>;
export const FAILED_STEP_LABEL: Record<FailedStep, string> = {
  QUEUED: "Queued",
  BUILDING: "Building",
  DEPLOYING: "Deploying",
  HEALTH_CHECK: "Health check",
};

/** One deploy, names and timings only: never its commit, branch, logs or error text. */
export const PlatformDeployRowSchema = z.object({
  id: z.string(),
  number: count,
  serviceName: z.string(),
  orgName: z.string(),
  /** The snapshot name ("Ada Obi", or "token: <token name>" for CI). */
  triggeredByName: z.string().nullable(),
  status: DeploymentStatusSchema,
  /** startedAt → finishedAt; null while it runs or when it never started. */
  durationSeconds: z.number().nullable(),
  createdAt: z.iso.datetime(),
  /** FAILED / GATE_FAILED only: the step it was in (GATE_FAILED is always HEALTH_CHECK). */
  failedStep: FailedStepSchema.nullable(),
});
export type PlatformDeployRow = z.infer<typeof PlatformDeployRowSchema>;

export const PlatformDeployPageSchema = z.object({
  items: z.array(PlatformDeployRowSchema),
  nextCursor: z.string().nullable(),
});
export type PlatformDeployPage = z.infer<typeof PlatformDeployPageSchema>;

// ── GET /platform/users ─────────────────────────────────────

export const PLATFORM_USER_SORTS = ["joined", "lastActive", "deploys", "failed"] as const;
export const PlatformUserSortSchema = z.enum(PLATFORM_USER_SORTS);
export type PlatformUserSort = z.infer<typeof PlatformUserSortSchema>;
export const PLATFORM_USERS_PAGE = 50;

export const PlatformUsersQuerySchema = z.object({
  sort: PlatformUserSortSchema.default("joined"),
  /** Part of the first or last name, case-insensitive. */
  q: z.string().trim().min(2).max(100).optional(),
  cursor: z.string().max(200).optional(),
});
export type PlatformUsersQuery = z.infer<typeof PlatformUsersQuerySchema>;

/** Their org: the ACTIVE membership, else the newest one; null = none (yet). */
const UserOrgSchema = z.object({ id: z.string(), name: z.string() }).nullable();

/** No email here: that's only the logged reveal. */
export const PlatformUserRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  org: UserOrgSchema,
  authProcess: AuthProviderSchema,
  createdAt: z.iso.datetime(),
  /** Newest Membership.lastActiveAt across their orgs. */
  lastActiveAt: z.iso.datetime().nullable(),
  /** Deploys they started (Deployment.triggeredById). */
  deploys: count,
  /** FAILED + GATE_FAILED. */
  failedDeploys: count,
});
export type PlatformUserRow = z.infer<typeof PlatformUserRowSchema>;

export const PlatformUserPageSchema = z.object({
  items: z.array(PlatformUserRowSchema),
  nextCursor: z.string().nullable(),
});
export type PlatformUserPage = z.infer<typeof PlatformUserPageSchema>;

// ── GET /platform/users/:id ─────────────────────────────────

export const PlatformUserDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  org: UserOrgSchema,
  authProcess: AuthProviderSchema,
  createdAt: z.iso.datetime(),
  lastActiveAt: z.iso.datetime().nullable(),
  deploys: z.object({
    total: count,
    succeeded: count,
    /** FAILED + GATE_FAILED. */
    failed: count,
    /** Same definition as the overview: SUCCESS ÷ (SUCCESS + FAILED + GATE_FAILED + ROLLED_BACK). Null = none finished. */
    successRate: z.number().nullable(),
  }),
  /** Their newest PLATFORM_USER_RECENT_DEPLOYS deploys. */
  recentDeploys: z.array(PlatformDeployRowSchema),
});
export type PlatformUserDetail = z.infer<typeof PlatformUserDetailSchema>;

// ── POST /platform/users/:id/email ──────────────────────────

/** The one response on /platform that carries an email. Each call writes a PlatformAccessLog row. */
export const PlatformUserEmailSchema = z.object({ email: z.string() });
export type PlatformUserEmail = z.infer<typeof PlatformUserEmailSchema>;
