import { z } from "zod";

/*
 * GET /dashboard : the Home page. Every role. Counts are worked out by the
 * database (count queries), never by sending whole lists to the browser.
 */

/** Every state of a deploy, matching the Prisma enum. Phase 2 fills these in. */
export const DeploymentStatusSchema = z.enum([
  "QUEUED",
  "BUILDING",
  "DEPLOYING",
  "HEALTH_CHECK",
  "SUCCESS",
  "GATE_FAILED",
  "ROLLED_BACK",
  "FAILED",
  "CANCELLED",
]);
export type DeploymentStatus = z.infer<typeof DeploymentStatusSchema>;

export const RecentDeploymentSchema = z.object({
  id: z.string(),
  /** Per-org counter: #418 */
  number: z.number().int(),
  status: DeploymentStatusSchema,
  serviceId: z.string(),
  serviceName: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  environmentName: z.string(),
  branch: z.string().nullable(),
  commitSha: z.string().nullable(),
  commitMessage: z.string().nullable(),
  triggeredByName: z.string().nullable(),
  createdAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
});
export type RecentDeployment = z.infer<typeof RecentDeploymentSchema>;

export const DashboardSchema = z.object({
  counts: z.object({
    projects: z.number().int(),
    /** Projects with at least one degraded or failed service (worst-status-wins). */
    projectsNeedingAttention: z.number().int(),
    environments: z.number().int(),
    services: z.number().int(),
    deploys: z.number().int(),
    deploysLast7Days: z.number().int(),
    serversTotal: z.number().int(),
    serversConnected: z.number().int(),
    serversOffline: z.number().int(),
  }),
  /** Newest first, at most 10. Empty until deploys exist (Phase 2). */
  recentDeployments: z.array(RecentDeploymentSchema),
});
export type Dashboard = z.infer<typeof DashboardSchema>;
