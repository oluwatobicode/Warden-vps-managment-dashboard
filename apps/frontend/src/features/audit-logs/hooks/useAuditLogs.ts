import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { AuditLogPage } from "shared-types";
import { api } from "../../../api/axiosinstance";

export const auditKeys = {
  all: ["audit-logs"] as const,
  page: (cursor: string | null, limit: number) => ["audit-logs", { cursor, limit }] as const,
};

/**
 * One page of GET /audit-logs, newest first. `cursor` = "rows older than
 * this one" (null = the newest page). The API's cursor means pages never
 * shift when new entries arrive at the top. ADMIN only.
 */
export function useAuditLogPage(cursor: string | null, limit: number) {
  return useQuery({
    queryKey: auditKeys.page(cursor, limit),
    queryFn: () => api.get<AuditLogPage>("/audit-logs", { limit: String(limit), ...(cursor ? { cursor } : {}) }),
    // Keep showing the current page while the next one loads: no flash of empty.
    placeholderData: keepPreviousData,
  });
}
