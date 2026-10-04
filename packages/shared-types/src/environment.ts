import { z } from "zod";
import { slugName } from "./field.js";

// POST /environments — flat design: the parent is named in the body.
export const CreateEnvironmentSchema = z.object({
  projectId: z.string().uuid(),
  environmentName: slugName,
  // Default branch services in this environment deploy from (e.g. "main").
  // Optional: a team may not have decided yet. Services can override it.
  branch: z.string().trim().min(1).max(100).optional(),
});
export type CreateEnvironmentInput = z.infer<typeof CreateEnvironmentSchema>;

// PATCH /environments/:id — projectId deliberately excluded: environments don't move.
export const UpdateEnvironmentSchema = CreateEnvironmentSchema.pick({
  environmentName: true,
  branch: true,
}).partial();
export type UpdateEnvironmentInput = z.infer<typeof UpdateEnvironmentSchema>;
