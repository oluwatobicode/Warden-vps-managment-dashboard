import { z } from "zod";

// ---------------------------------------------------------------------------
// Input fields
// ---------------------------------------------------------------------------

// Env var names: UPPER_SNAKE_CASE, not starting with a digit.
export const variableKey = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Z_][A-Z0-9_]*$/, {
    message: "Use UPPER_SNAKE_CASE, e.g. DATABASE_URL",
  });

// A required string on INPUT (empty is legal; not trimmed — a trailing space
// can be deliberate). `null` only ever appears on OUTPUT, meaning "masked".
const variableValue = z.string().max(16_000);

// POST /environment-variables — every service in the environment receives it.
export const CreateEnvironmentVariableSchema = z.object({
  environmentId: z.string().uuid(),
  key: variableKey,
  value: variableValue,
  isSecret: z.boolean().default(true), // default on CREATE only
});
export type CreateEnvironmentVariableInput = z.infer<
  typeof CreateEnvironmentVariableSchema
>;

// POST /service-variables — the environment is implied by the service,
// so the client doesn't (and can't) send it.
export const CreateServiceVariableSchema = z.object({
  serviceId: z.string().uuid(),
  key: variableKey,
  value: variableValue,
  isSecret: z.boolean().default(true),
});
export type CreateServiceVariableInput = z.infer<
  typeof CreateServiceVariableSchema
>;

// PATCH — NO defaults: with a default, editing only the value would silently
// flip isSecret back to true. No `key`: renaming = delete + create.
export const UpdateVariableSchema = z.object({
  value: variableValue.optional(),
  isSecret: z.boolean().optional(),
});
export type UpdateVariableInput = z.infer<typeof UpdateVariableSchema>;

// ---------------------------------------------------------------------------
// Output — a description, so no rules or defaults.
// ---------------------------------------------------------------------------
export const VariableScopeSchema = z.enum(["environment", "service"]);
export type VariableScope = z.infer<typeof VariableScopeSchema>;

export const VariableSchema = z.object({
  id: z.string(),
  key: z.string(),
  // Plain text when isSecret is false; null when secret (the UI draws dots).
  // The encrypted value never leaves the api.
  value: z.string().nullable(),
  isSecret: z.boolean(),
  scope: VariableScopeSchema,
  updatedAt: z.iso.datetime(),
});
export type Variable = z.infer<typeof VariableSchema>;

// GET .../:id/reveal — the deliberate "show me the real value".
export const RevealedVariableSchema = z.object({
  key: z.string(),
  value: z.string(),
});
export type RevealedVariable = z.infer<typeof RevealedVariableSchema>;

// GET /service-variables/resolved — what the container would receive.
// `source` lets the UI say "inherited from the environment".
export const ResolvedVariableSchema = z.object({
  key: z.string(),
  value: z.string().nullable(), // null = secret, masked
  isSecret: z.boolean(),
  source: VariableScopeSchema,
});
export type ResolvedVariable = z.infer<typeof ResolvedVariableSchema>;
