import { z } from "zod";
import { RoleSchema } from "./auth.js";

export const AuditActionSchema = z.enum([
  "variable.revealed",
  "variable.imported",
  "invitation.created",
  "invitation.revoked",
  "member.role_changed",
  "member.removed",
  "api_token.created",
  "api_token.revoked",
  "server.created",
  "server.deleted",
  "server.cleanup_run",
  "ssh_key.created",
  "ssh_key.deleted",
  "project.created",
  "project.deleted",
  "environment.created",
  "environment.deleted",
  "notification_channel.created",
  "notification_channel.updated",
  "notification_channel.deleted",
  "notification_channel.revealed",
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
  "notification_channel",
]);
export type AuditEntityType = z.infer<typeof AuditEntityTypeSchema>;

export type AuditMetadata = Record<string, string | number | boolean | null>;

export const ListAuditLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.uuid().optional(),
});
export type ListAuditLogsQuery = z.infer<typeof ListAuditLogsQuerySchema>;

/**
 * GET /project-activity : one project's events, for every role. projectId is
 * REQUIRED: this route must never be able to return the org-wide log, which
 * stays Admin-only at /audit-logs.
 */
export const ListProjectActivityQuerySchema = ListAuditLogsQuerySchema.extend({
  projectId: z.uuid("Pick a project"),
});
export type ListProjectActivityQuery = z.infer<typeof ListProjectActivityQuerySchema>;

export const AuditLogSchema = z.object({
  id: z.string(),
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
  nextCursor: z.string().nullable(),
});
export type AuditLogPage = z.infer<typeof AuditLogPageSchema>;
