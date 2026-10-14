import { z } from "zod";
import { slugName } from "./field.js";
import { ServiceStatusSchema } from "./service.js";

export const CreateProjectSchema = z.object({
  projectName: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters")
    .max(80, "Use at most 80 characters"),
  projectDescription: z.string().trim().max(500, "Use at most 500 characters").optional(),

  environments: z
    .array(slugName)
    .min(1, "At least one environment is required")
    .refine((names) => new Set(names).size === names.length, {
      message: "Environment names must be unique",
    }),
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = CreateProjectSchema.pick({
  projectName: true,
  projectDescription: true,
}).partial();
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

export const EnvironmentSchema = z.object({
  id: z.string(),
  environmentName: z.string(),
  branch: z.string().nullable(),
  serviceCount: z.number().int(),
  // worst status of this environment's services
  status: ServiceStatusSchema,
  createdAt: z.iso.datetime(),
});
export type Environment = z.infer<typeof EnvironmentSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  projectName: z.string(),
  slug: z.string(),
  projectDescription: z.string().nullable(),
  environmentCount: z.number().int(),
  serviceCount: z.number().int(),
  // worst status across every service in every environment
  status: ServiceStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const ProjectDetailSchema = ProjectSchema.extend({
  environments: z.array(EnvironmentSchema),
});
export type ProjectDetail = z.infer<typeof ProjectDetailSchema>;
