import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { AuditLogPage } from "shared-types";
import { api } from "../../../api/axiosinstance";

/**
 * Where a list of audit entries comes from:
 *   org     → GET /audit-logs, the whole organization (ADMIN only)
 *   project → GET /project-activity?projectId=, one project (every role)
 */
export type ActivitySource = { kind: "org" } | { kind: "project"; projectId: string };

export const auditKeys = {
  all: ["audit-logs"] as const,
  page: (source: ActivitySource, cursor: string | null, limit: number) => ["audit-logs", source, { cursor, limit }] as const,
};

/**
 * One page of entries, newest first. `cursor` = "rows older than this one"
 * (null = the newest page). The API's cursor means pages never shift when
 * new entries arrive at the top.
 */
export function useActivityPage(source: ActivitySource, cursor: string | null, limit: number) {
  return useQuery({
    queryKey: auditKeys.page(source, cursor, limit),
    queryFn: () => {
      const params: Record<string, string> = { limit: String(limit), ...(cursor ? { cursor } : {}) };
      return source.kind === "org"
        ? api.get<AuditLogPage>("/audit-logs", params)
        : api.get<AuditLogPage>("/project-activity", { ...params, projectId: source.projectId });
    },
    // Keep showing the current page while the next one loads: no flash of empty.
    placeholderData: keepPreviousData,
  });
}
