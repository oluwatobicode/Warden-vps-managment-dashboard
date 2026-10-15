import type { AuditLog, Role } from "shared-types";
import { ROLE_LABEL } from "../../../utils/roles";

export type AuditArea = "secrets" | "team" | "access" | "infra" | "projects" | "notifications";

const role = (r: unknown) => (typeof r === "string" && r in ROLE_LABEL ? ROLE_LABEL[r as Role] : String(r ?? ""));
const s = (v: unknown) => (v === undefined || v === null ? "" : String(v));

/**
 * One sentence per entry, from its action + metadata. Metadata never holds
 * secret values (the API's rule), so everything here is safe to show.
 */
export function describeAudit(e: AuditLog): { text: string; area: AuditArea } {
  const m = e.metadata ?? {};
  switch (e.action) {
    case "variable.revealed":
      return { area: "secrets", text: `Revealed ${s(m.key)} (${s(m.scope)} variable)` };
    case "variable.imported":
      return { area: "secrets", text: `Imported ${s(m.scope)} variables: ${s(m.added)} added, ${s(m.updated)} updated, ${s(m.skipped)} skipped` };
    case "invitation.created":
      return { area: "team", text: `Invited ${s(m.email)} as ${role(m.role)}` };
    case "invitation.revoked":
      return { area: "team", text: `Revoked the invitation for ${s(m.email)}` };
    case "member.role_changed":
      return { area: "team", text: `Changed ${s(m.email)}'s role from ${role(m.from)} to ${role(m.to)}` };
    case "member.removed":
      return { area: "team", text: `Removed ${s(m.email)} (was ${role(m.role)})` };
    case "api_token.created":
      return { area: "access", text: `Created API token ${s(m.name)} (${s(m.scope).toLowerCase()} scope, ${s(m.expiresIn)})` };
    case "api_token.revoked":
      return { area: "access", text: `Revoked API token ${s(m.name)}` };
    case "ssh_key.created":
      return { area: "access", text: `Added SSH key ${s(m.name)}` };
    case "ssh_key.deleted":
      return { area: "access", text: `Deleted SSH key ${s(m.name)}` };
    case "server.created":
      return { area: "infra", text: `Added server ${s(m.name)} (${s(m.host)})` };
    case "server.deleted":
      return { area: "infra", text: `Removed server ${s(m.name)} (${s(m.host)})` };
    case "server.cleanup_run":
      return { area: "infra", text: `Ran Docker cleanup on ${s(m.name)}` };
    case "project.created":
      return { area: "projects", text: `Created project ${s(m.name)}` };
    case "project.deleted":
      return { area: "projects", text: `Deleted project ${s(m.name)}` };
    case "environment.created":
      return { area: "projects", text: `Created environment ${s(m.name)}` };
    case "environment.deleted":
      return { area: "projects", text: `Deleted environment ${s(m.name)}` };
    case "notification_channel.created":
      return { area: "notifications", text: `Added ${s(m.type).toLowerCase()} channel ${s(m.name)}` };
    case "notification_channel.updated":
      return { area: "notifications", text: `Changed channel ${s(m.name)} (${s(m.changed).replace(/,/g, ", ")})` };
    case "notification_channel.deleted":
      return { area: "notifications", text: `Deleted ${s(m.type).toLowerCase()} channel ${s(m.name)}` };
    case "notification_channel.revealed":
      return { area: "secrets", text: `Revealed the webhook URL of ${s(m.name)}` };
    default:
      // An action added on the API before this list knew it: still readable.
      return { area: "projects", text: e.action };
  }
}

/** "ada@acme.dev · Admin", or "API token github-actions". */
export function auditActor(e: AuditLog): string {
  if (e.apiTokenName || e.apiTokenId) return `API token ${e.apiTokenName ?? "(deleted)"}`;
  if (e.performedByEmail) return e.performedByRole ? `${e.performedByEmail} · ${role(e.performedByRole)}` : e.performedByEmail;
  return "someone who has since been removed";
}
