import { z } from "zod";
import { RoleSchema } from "./auth.js";

// Every action the audit log knows, as "thing.what_happened". The DB column is
// a plain String, so adding an action here needs no migration.
export const AuditActionSchema = z.enum([
  "variable.revealed",
  "invitation.created",
  "invitation.revoked",
  "member.role_changed",
  "member.removed",
  "api_token.created",
  "api_token.revoked",
  "server.created",
  "server.deleted",
  "ssh_key.created",
  "ssh_key.deleted",
  "project.created",
  "project.deleted",
  "environment.created",
  "environment.deleted",
]);
export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AuditEntityTypeSchema = z.enum([
  "variable",
  "invitation",
  "member",
  "api_token",
  "server",
  "ssh_key",
  "project",
  "environment",
]);
export type AuditEntityType = z.infer<typeof AuditEntityTypeSchema>;

// Flat details: names, emails, roles. NEVER a secret value — every admin can
// read this log, forever.
export type AuditMetadata = Record<string, string | number | boolean | null>;

// GET /audit-logs?limit=&cursor= — query values arrive as text, hence coerce.
export const ListAuditLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.uuid().optional(),
});
export type ListAuditLogsQuery = z.infer<typeof ListAuditLogsQuerySchema>;

export const AuditLogSchema = z.object({
  id: z.string(),
  // string, not the enum: old rows may hold names that were later renamed
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  performedById: z.string().nullable(),
  performedByEmail: z.string().nullable(),
  performedByRole: RoleSchema.nullable(),
  apiTokenId: z.string().nullable(),
  apiTokenName: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type AuditLog = z.infer<typeof AuditLogSchema>;

export const AuditLogPageSchema = z.object({
  items: z.array(AuditLogSchema),
  nextCursor: z.string().nullable(), // null = last page
});
export type AuditLogPage = z.infer<typeof AuditLogPageSchema>;
