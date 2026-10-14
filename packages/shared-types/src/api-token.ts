import { z } from "zod";
import { RoleSchema } from "./auth.js";

export const ApiTokenScopeSchema = z.enum(["READ", "DEPLOY", "ADMIN"]);
export type ApiTokenScope = z.infer<typeof ApiTokenScopeSchema>;
export const ApiTokenExpirySchema = z.enum(["30d", "90d", "1y", "never"]);
export type ApiTokenExpiry = z.infer<typeof ApiTokenExpirySchema>;

export const CreateApiTokenSchema = z.object({
  apiName: z.string().trim().min(1).max(80),
  apiTokenScope: ApiTokenScopeSchema.default("READ"),
  expiresIn: ApiTokenExpirySchema.default("90d"),
});
export type CreateApiTokenInput = z.infer<typeof CreateApiTokenSchema>;

export const ApiTokenSchema = z.object({
  id: z.string(),
  apiName: z.string(),
  tokenPrefix: z.string(),
  apiTokenScope: ApiTokenScopeSchema,
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
});

export type ApiTokenWhoami = z.infer<typeof ApiTokenWhoamiSchema>;
