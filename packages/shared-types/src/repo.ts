import { z } from "zod";
import { slugName } from "./field.js";
import { variableKey } from "./variable.js";
import { branch, port } from "./service.js";
import { BuildMethodSchema, command, repoPath, watchPath } from "./deploy.js";

/*
 * "Add service → From GitHub": Warden reads the repo through the GitHub App
 * (or GitHub's public API) and prefills each app it finds. Railpack still
 * does the real build, so this is a well-informed guess the first deploy
 * confirms. See docs/PHASE-2-DEPLOY-PLAN.md.
 */

/** "owner/name", the way GitHub writes it. */
export const repoFullName = z
  .string()
  .trim()
  .regex(/^[\w.-]+\/[\w.-]+$/, "Use owner/name, like acme/api");

/** One app Warden found in the repo, with its suggested settings. */
export const DetectedAppSchema = z.object({
  /** Its folder ("" = the repo root). */
  path: z.string(),
  /** A suggested service name. */
  name: z.string(),
  /** package.json "name", when there is one. */
  packageName: z.string().nullable(),
  /** For people: "Vite", "NestJS", "Express", "Python", "Dockerfile"… */
  framework: z.string(),
  type: z.enum(["APPLICATION", "WORKER"]),
  /** Built to static files and served as a website (Railpack serves them on $PORT). */
  website: z.boolean(),
  buildMethod: BuildMethodSchema,
  rootDirectory: z.string(),
  dockerfilePath: z.string(),
  buildCommand: z.string().nullable(),
  startCommand: z.string().nullable(),
  staticOutputDir: z.string().nullable(),
  port: z.number().int().nullable(),
  healthCheckPath: z.string(),
  watchPaths: z.array(z.string()),
  /** Variables baked in at BUILD time (VITE_*, NEXT_PUBLIC_*…) that the repo mentions: set them before the first deploy. */
  buildVars: z.array(z.string()),
  /** Things worth telling the person, in plain words. */
  notes: z.array(z.string()),
});
export type DetectedApp = z.infer<typeof DetectedAppSchema>;

/** GET /github/inspect */
export const RepoInspectionSchema = z.object({
  fullName: z.string(),
  htmlUrl: z.string(),
  private: z.boolean(),
  defaultBranch: z.string(),
  branch: z.string(),
  /** Several apps in one repo (workspaces). */
  monorepo: z.boolean(),
  /** GitHub sends at most ~100k files; a bigger repo may hide some apps. */
  truncated: z.boolean(),
  apps: z.array(DetectedAppSchema),
});
export type RepoInspection = z.infer<typeof RepoInspectionSchema>;

export const InspectRepoQuerySchema = z.object({
  /** Through the GitHub App (private repos). Absent = a public repo. */
  installationId: z.uuid().optional(),
  repo: repoFullName,
  branch: branch.optional(),
});
export type InspectRepoQuery = z.infer<typeof InspectRepoQuerySchema>;

const NewServiceFromRepoSchema = z
  .object({
    serviceName: slugName,
    type: z.enum(["APPLICATION", "WORKER"]),
    serverId: z.uuid("Pick a server"),
    rootDirectory: repoPath,
    dockerfilePath: repoPath.min(1),
    buildCommand: command.nullable(),
    startCommand: command.nullable(),
    staticOutputDir: repoPath.nullable(),
    port: port.nullable(),
    healthCheckPath: z.string().trim().regex(/^\/[A-Za-z0-9._~!$&'()*+,;=:@%\/?-]*$/, "Start with / (e.g. /health)"),
    watchPaths: z.array(watchPath).max(20),
    /** Saved as this service's own (secret) variables before the first build. */
    variables: z
      .array(z.object({ key: variableKey, value: z.string().max(16_000) }))
      .max(50)
      .refine((v) => new Set(v.map((x) => x.key)).size === v.length, "Each variable only once"),
  })
  .superRefine((s, ctx) => {
    if (s.type === "APPLICATION" && s.port == null) ctx.addIssue({ code: "custom", path: ["port"], message: "An application needs a port" });
    if (s.type === "WORKER" && s.port != null) ctx.addIssue({ code: "custom", path: ["port"], message: "A worker has no port" });
  });
export type NewServiceFromRepo = z.infer<typeof NewServiceFromRepoSchema>;

/** POST /services/from-repo : one or more services from one repo, optionally deployed at once. */
export const CreateFromRepoSchema = z
  .object({
    environmentId: z.uuid(),
    installationId: z.uuid().nullish(),
    repo: repoFullName,
    branch,
    deploy: z.boolean().default(true),
    services: z.array(NewServiceFromRepoSchema).min(1, "Pick at least one app").max(10, "At most 10 at once"),
  })
  .refine((v) => new Set(v.services.map((s) => s.serviceName)).size === v.services.length, { path: ["services"], message: "Each service needs its own name" });
export type CreateFromRepoInput = z.infer<typeof CreateFromRepoSchema>;

export const CreateFromRepoResultSchema = z.object({
  services: z.array(
    z.object({
      id: z.string(),
      serviceName: z.string(),
      /** The first deploy, if it started. */
      deploymentId: z.string().nullable(),
      /** Why it didn't deploy straight away (e.g. the server's proxy isn't set up). */
      deployNote: z.string().nullable(),
    }),
  ),
});
export type CreateFromRepoResult = z.infer<typeof CreateFromRepoResultSchema>;
