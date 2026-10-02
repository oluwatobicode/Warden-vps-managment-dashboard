import { z } from "zod";

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

// Free-text names, not an enum: the UI suggests production/staging/preview but
// a team may want "qa" or "demo". Lowercased so "Production" === "production".
const environmentName = z.string().trim().toLowerCase().min(1).max(40);

// POST /projects
export const CreateProjectSchema = z.object({
  projectName: z.string().trim().min(2).max(80),
  projectDescription: z.string().trim().max(500).optional(),
  // The multi-select from the create form. At least one, no duplicates.
  environments: z
    .array(environmentName)
    .min(1, "At least one environment is required")
    .refine((names) => new Set(names).size === names.length, {
      message: "Environment names must be unique",
    }),
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

// PATCH /projects/:id — name and description only. Environments have their own
// routes; the slug is server-owned and never changes on rename (slugs are URLs).
export const UpdateProjectSchema = CreateProjectSchema.pick({
  projectName: true,
  projectDescription: true,
}).partial();
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------
export const EnvironmentSchema = z.object({
  id: z.string(),
  environmentName: z.string(),
  branch: z.string().nullable(),
  serviceCount: z.number().int(),
  createdAt: z.iso.datetime(),
});
export type Environment = z.infer<typeof EnvironmentSchema>;

// The project card. No status yet — it's a rollup over services, which don't
// exist until the services module lands.
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

// The project page: the card plus its environments.
export const ProjectDetailSchema = ProjectSchema.extend({
  environments: z.array(EnvironmentSchema),
});
export type ProjectDetail = z.infer<typeof ProjectDetailSchema>;
