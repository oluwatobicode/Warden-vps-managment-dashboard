import { z } from "zod";
import { DeploymentStatusSchema } from "./dashboard.js";

/*
 * Phase 2: deploying apps (docs/PHASE-2-DEPLOY-PLAN.md). The api records and
 * queues; the worker clones, builds, starts, health-checks and swaps.
 */

export const BuildMethodSchema = z.enum(["DOCKERFILE", "RAILPACK"]);
export type BuildMethod = z.infer<typeof BuildMethodSchema>;

/**
 * A path inside the repo: letters, digits, . _ - and /, no "..", no leading
 * slash. These end up in shell commands on the server, so anything else is
 * refused rather than escaped.
 */
export const repoPath = z
  .string()
  .trim()
  .max(200, "Use at most 200 characters")
  .regex(/^(?!\/)(?!.*\.\.)[A-Za-z0-9._\/-]*$/, "Use a path inside the repo, like apps/api (letters, digits, . _ - /)");

export const command = z
  .string()
  .trim()
  .max(500, "Use at most 500 characters")
  .refine((s) => !/[\r\n]/.test(s), "Use one line (join commands with &&)");

/** A watch path: a folder or glob, like apps/api/** or packages/**. */
export const watchPath = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^(?!\/)[A-Za-z0-9._\/*-]+$/, "Use a folder or pattern like apps/api/**");

export const DeploySettingsSchema = z.object({
  rootDirectory: z.string(),
  dockerfilePath: z.string(),
  buildCommand: z.string().nullable(),
  startCommand: z.string().nullable(),
  releaseCommand: z.string().nullable(),
  /** A website's built folder, served as static files (Railpack's RAILPACK_SPA_OUTPUT_DIR). */
  staticOutputDir: z.string().nullable(),
  healthCheckPath: z.string(),
  watchPaths: z.array(z.string()),
  autoDeploy: z.boolean(),
  /** Null = a public repo, cloned without a key. */
  githubInstallationId: z.string().nullable(),
  githubRepoId: z.number().int().nullable(),
});
export type DeploySettings = z.infer<typeof DeploySettingsSchema>;

export const ServiceDomainSchema = z.object({
  id: z.string(),
  domain: z.string(),
  /** Last time its DNS pointed at the service's server. Null = not checked or not pointing there. */
  verifiedAt: z.iso.datetime().nullable(),
});
export type ServiceDomain = z.infer<typeof ServiceDomainSchema>;

/** POST /service-domains : a custom domain, served over HTTPS (Let's Encrypt) from the next deploy. */
export const AddDomainSchema = z.object({
  serviceId: z.uuid(),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .max(253)
    .regex(/^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/, "Enter a domain like api.example.com")
    .refine((d) => !/^\d+(\.\d+){3}$/.test(d), "Enter a domain name, not an IP address")
    .refine((d) => !d.endsWith(".sslip.io"), "sslip.io addresses are given automatically"),
});
export type AddDomainInput = z.infer<typeof AddDomainSchema>;

/** GET /services/:id/deploy-settings */
export const DeployInfoSchema = z.object({
  settings: DeploySettingsSchema,
  domains: z.array(ServiceDomainSchema),
  /** The server's public IP: what a custom domain's DNS (A record) must point to. */
  serverIp: z.string().nullable(),
  /** Where the app answers: its custom domain, else its sslip.io address. Null for workers / no server. */
  url: z.string().nullable(),
  /** Traefik is set up on the service's server. Deploying an APPLICATION needs it. */
  proxyReady: z.boolean(),
});
export type DeployInfo = z.infer<typeof DeployInfoSchema>;

/** PATCH /services/:id/deploy-settings */
export const UpdateDeploySettingsSchema = z
  .object({
    rootDirectory: repoPath.optional(),
    dockerfilePath: repoPath.min(1, "Enter the Dockerfile's path").optional(),
    buildCommand: command.nullish(),
    startCommand: command.nullish(),
    releaseCommand: command.nullish(),
    staticOutputDir: repoPath.nullish(),
    healthCheckPath: z
      .string()
      .trim()
      .max(200)
      .regex(/^\/[A-Za-z0-9._~!$&'()*+,;=:@%\/?-]*$/, "Start with / (e.g. /health)")
      .optional(),
    watchPaths: z.array(watchPath).max(20, "At most 20 paths").optional(),
    autoDeploy: z.boolean().optional(),
    githubInstallationId: z.uuid().nullish(),
    githubRepoId: z.number().int().positive().nullish(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "Nothing to update" });
export type UpdateDeploySettingsInput = z.infer<typeof UpdateDeploySettingsSchema>;

/** POST /deployments : deploy the branch's newest commit, or a given one. */
export const TriggerDeploySchema = z.object({
  serviceId: z.uuid(),
  commitSha: z
    .string()
    .trim()
    .regex(/^[0-9a-f]{7,40}$/i, "Use a commit hash (7–40 hex characters)")
    .optional(),
});
export type TriggerDeployInput = z.infer<typeof TriggerDeploySchema>;

export const DeploymentSchema = z.object({
  id: z.string(),
  number: z.number().int(),
  status: DeploymentStatusSchema,
  /** MANUAL = a person (or token) pressed Deploy / Rollback; AUTOMATED = a git push. */
  type: z.enum(["MANUAL", "AUTOMATED"]),
  branch: z.string().nullable(),
  commitSha: z.string().nullable(),
  commitMessage: z.string().nullable(),
  triggeredByName: z.string().nullable(),
  buildMethod: BuildMethodSchema.nullable(),
  imageTag: z.string().nullable(),
  /** Set on a rollback: the number it brought back. */
  rollbackOfNumber: z.number().int().nullable(),
  /** This is the version serving right now. */
  live: z.boolean(),
  createdAt: z.iso.datetime(),
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
});
export type Deployment = z.infer<typeof DeploymentSchema>;

export const DeploymentStepSchema = z.object({
  status: DeploymentStatusSchema,
  message: z.string().nullable(),
  at: z.iso.datetime(),
});

export const DeploymentDetailSchema = DeploymentSchema.extend({
  serviceId: z.string(),
  serviceName: z.string(),
  /** The steps, oldest first. A step's duration = the next step's time minus its own. */
  history: z.array(DeploymentStepSchema),
});
export type DeploymentDetail = z.infer<typeof DeploymentDetailSchema>;

/** A piece of a deploy's output. `seq` orders them; live and stored chunks share it. */
export const DeployLogChunkSchema = z.object({ seq: z.number().int(), text: z.string() });
export type DeployLogChunk = z.infer<typeof DeployLogChunkSchema>;

/** BullMQ payloads, api → worker. */
export const DeployJobSchema = z.object({
  deploymentId: z.uuid(),
  serviceId: z.uuid(),
  organizationId: z.uuid(),
});
export type DeployJob = z.infer<typeof DeployJobSchema>;

export const ProxyJobSchema = z.object({ serverId: z.uuid(), organizationId: z.uuid() });
export type ProxyJob = z.infer<typeof ProxyJobSchema>;

export const DEPLOY_JOBS = { deploy: "deploy", proxy: "proxy-setup", prune: "deploy-prune" } as const;

/** Redis channels the worker publishes on; the api relays them to browsers. */
export const deployLogChannel = (deploymentId: string) => `deploy-log:${deploymentId}`;

/**
 * Socket.io (namespace /deploys). The browser sends `watch` with a deployment
 * id; the api checks it belongs to the session's org, then streams.
 */
export const DEPLOY_SOCKET = { namespace: "/deploys", watch: "watch", unwatch: "unwatch", log: "log", status: "status" } as const;

/** "warden-app-<id8>" names: the same in api and worker. */
export const shortId = (id: string) => id.replace(/-/g, "").slice(0, 8);

/** An app's automatic address: <service>-<id8>.<ip>.sslip.io (http). */
export function sslipHost(service: { id: string; serviceName: string }, serverIp: string): string {
  return `${service.serviceName.toLowerCase().slice(0, 40)}-${shortId(service.id)}.${serverIp}.sslip.io`;
}
