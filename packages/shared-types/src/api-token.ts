import { z } from "zod";
import { RoleSchema } from "./auth.js";

export const ApiTokenScopeSchema = z.enum(["READ", "DEPLOY", "ADMIN"]);
export type ApiTokenScope = z.infer<typeof ApiTokenScopeSchema>;
export const ApiTokenExpirySchema = z.enum(["30d", "90d", "1y", "never"]);
export type ApiTokenExpiry = z.infer<typeof ApiTokenExpirySchema>;

/**
 * Tokens only work on the deploy routes (trigger, rollback, cancel, read), so
 * new ones are READ or DEPLOY; ADMIN stays in the enum for tokens made before.
 */
export const CreateApiTokenSchema = z.object({
  apiName: z.string().trim().min(1, "Give the token a name").max(80, "Use at most 80 characters"),
  apiTokenScope: z.enum(["READ", "DEPLOY"]).default("DEPLOY"),
  expiresIn: ApiTokenExpirySchema.default("90d"),
  /** Only this project's services. Empty = every project in the org. */
  projectId: z.uuid().nullish(),
});
export type CreateApiTokenInput = z.infer<typeof CreateApiTokenSchema>;

export const ApiTokenSchema = z.object({
  id: z.string(),
  apiName: z.string(),
  tokenPrefix: z.string(),
  apiTokenScope: ApiTokenScopeSchema,
  projectId: z.string().nullable(),
  projectName: z.string().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  lastUsedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type ApiToken = z.infer<typeof ApiTokenSchema>;

export const CreatedApiTokenSchema = ApiTokenSchema.extend({
  token: z.string(),
});

export type CreatedApiToken = z.infer<typeof CreatedApiTokenSchema>;

export const ApiTokenWhoamiSchema = z.object({
  tokenId: z.string(),
  organizationId: z.string(),
  role: RoleSchema,
  projectId: z.string().nullable(),
});

export type ApiTokenWhoami = z.infer<typeof ApiTokenWhoamiSchema>;
