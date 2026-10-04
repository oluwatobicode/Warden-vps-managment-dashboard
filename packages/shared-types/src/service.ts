import { z } from "zod";
import { slugName } from "./field.js";

// Mirrors Prisma's enums exactly.
export const ServiceTypeSchema = z.enum(["APPLICATION", "WORKER", "DATABASE", "COMPOSE"]);
export type ServiceType = z.infer<typeof ServiceTypeSchema>;

export const ServiceStatusSchema = z.enum(["NOT_DEPLOYED", "DEPLOYING", "HEALTHY", "DEGRADED", "FAILED"]);
export type ServiceStatus = z.infer<typeof ServiceStatusSchema>;

// Only GitHub for Phase 1 — the pipeline clones from there and nowhere else.
const githubRepoUrl = z
  .string()
  .trim()
  .url()
  .refine(
    (u) => {
      try {
        return new URL(u).hostname === "github.com";
      } catch {
        return false;
      }
    },
    { message: "Only github.com repositories are supported" },
  );

const branch = z.string().trim().min(1).max(100);
const port = z.number().int().min(1).max(65535);
const image = z.string().trim().min(1).max(200);

// What the type allows. Written once, used by create (here) and by the API's
// update path (which has to merge the body with the existing row first).
export function serviceTypeIssues(s: {
  type: ServiceType;
  port?: number | null;
  githubRepoUrl?: string | null;
  image?: string | null;
}): Array<{ path: string[]; message: string }> {
  const issues: Array<{ path: string[]; message: string }> = [];
  if (s.type === "DATABASE" || s.type === "COMPOSE") {
    issues.push({ path: ["type"], message: "This service type is not available yet" });
    return issues;
  }
  if (s.type === "APPLICATION" && s.port == null) {
    issues.push({ path: ["port"], message: "An application must expose a port" });
  }
  if (s.type === "WORKER" && s.port != null) {
    issues.push({ path: ["port"], message: "A worker has no port — remove it" });
  }
  if (!s.githubRepoUrl && !s.image) {
    issues.push({ path: ["githubRepoUrl"], message: "Provide a GitHub repo URL or an image" });
  }
  return issues;
}

// POST /services
export const CreateServiceSchema = z
  .object({
    environmentId: z.string().uuid(), // flat design: parent in the body
    serviceName: slugName,
    type: ServiceTypeSchema.default("APPLICATION"),
    githubRepoUrl: githubRepoUrl.optional(),
    // Null/absent = inherit Environment.branch.
    branch: branch.optional(),
    port: port.optional(),
    // For services that deploy a prebuilt image instead of building a repo.
    image: image.optional(),
  })
  .superRefine((data, ctx) => {
    for (const i of serviceTypeIssues(data)) {
      ctx.addIssue({ code: "custom", path: i.path, message: i.message });
    }
  });
export type CreateServiceInput = z.infer<typeof CreateServiceSchema>;

// PATCH /services/:id — no environmentId (services don't move between
// environments) and no type (a worker becoming an app is a new service).
// `null` clears a field; absent leaves it alone.
export const UpdateServiceSchema = z.object({
  serviceName: slugName.optional(),
  githubRepoUrl: githubRepoUrl.nullish(),
  branch: branch.nullish(),
  port: port.nullish(),
  image: image.nullish(),
});
export type UpdateServiceInput = z.infer<typeof UpdateServiceSchema>;

export const ServiceSchema = z.object({
  id: z.string(),
  serviceName: z.string(),
  type: ServiceTypeSchema,
  status: ServiceStatusSchema,
  githubRepoUrl: z.string().nullable(),
  branch: z.string().nullable(),
  port: z.number().int().nullable(),
  image: z.string().nullable(),
  environmentId: z.string(),
  serverId: z.string().nullable(), // null until assigned (servers module)
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Service = z.infer<typeof ServiceSchema>;
