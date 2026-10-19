import { useQuery } from "@tanstack/react-query";
import type { Dashboard } from "shared-types";
import { api } from "../../../api/axiosinstance";

export const dashboardKeys = { all: ["dashboard"] as const };

/** The Home page's counts and recent deployments, in one request. Refreshes every minute. */
export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.all,
    queryFn: () => api.get<Dashboard>("/dashboard"),
    refetchInterval: 60_000,
  });
}
