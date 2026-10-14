import type { Role } from "shared-types";

// Order and wording follow the role table (CLAUDE.md, decided 2026-10-02).
export const ROLE_ORDER: Role[] = ["VIEWER", "DEVELOPER", "DEV_OPS", "ADMIN"];

export const ROLE_DETAIL: Record<Role, string> = {
  VIEWER: "Read-only. Sees projects, services, servers. Secrets stay masked.",
  DEVELOPER: "Adds and edits services and variables, reveals secrets. Deploys and rolls back.",
  DEV_OPS: "Everything a Developer can, plus projects, environments, servers and SSH keys.",
  ADMIN: "Everything, plus the team, roles, API tokens, notifications and the organization.",
};

export const ROLE_DOT: Record<Role, string> = {
  VIEWER: "bg-sand",
  DEVELOPER: "bg-brand",
  DEV_OPS: "bg-serious",
  ADMIN: "bg-good",
};
