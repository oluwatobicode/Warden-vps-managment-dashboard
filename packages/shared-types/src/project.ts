import { z } from "zod";
import { environmentName } from "./field.js";

export const CreateProjectSchema = z.object({
  projectName: z.string().trim().min(2).max(80),
  projectDescription: z.string().trim().max(500).optional(),

  environments: z
    .array(environmentName)
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
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const ProjectDetailSchema = ProjectSchema.extend({
  environments: z.array(EnvironmentSchema),
});
export type ProjectDetail = z.infer<typeof ProjectDetailSchema>;
