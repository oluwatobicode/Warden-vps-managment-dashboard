import type { Role } from "shared-types";

// Each role can do everything the one before it can (see apps/frontend/claude.md).
const RANK: Record<Role, number> = { VIEWER: 0, DEVELOPER: 1, DEV_OPS: 2, ADMIN: 3 };

export const ROLE_LABEL: Record<Role, string> = {
  VIEWER: "Viewer",
  DEVELOPER: "Developer",
  DEV_OPS: "DevOps",
  ADMIN: "Admin",
};

/** Can `role` do what `min` can? For hiding buttons only: the API is the real gate. */
export function atLeast(role: Role | undefined, min: Role): boolean {
  return role !== undefined && RANK[role] >= RANK[min];
}
