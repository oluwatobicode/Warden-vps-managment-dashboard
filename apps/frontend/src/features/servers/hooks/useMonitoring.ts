import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CleanupPreview, DockerCleanup, ServerContainerList, ServerMetrics } from "shared-types";
import { api } from "../../../api/axiosinstance";
import { serverKeys } from "./useServers";

export const monitoringKeys = {
  metrics: (serverId: string) => ["server-metrics", serverId] as const,
  containers: (serverId: string) => ["server-containers", serverId] as const,
  cleanups: (serverId: string) => ["docker-cleanups", serverId] as const,
  preview: (serverId: string) => ["docker-cleanups", serverId, "preview"] as const,
};

/** The worker polls every 60s, so refreshing faster would only re-read the same rows. */
const POLL_MS = 60_000;

export function useServerMetrics(serverId: string) {
  return useQuery({
    queryKey: monitoringKeys.metrics(serverId),
    queryFn: () => api.get<ServerMetrics>("/server-metrics", { serverId }),
    enabled: !!serverId,
    refetchInterval: POLL_MS,
  });
}

export function useServerContainers(serverId: string) {
  return useQuery({
    queryKey: monitoringKeys.containers(serverId),
    queryFn: () => api.get<ServerContainerList>("/server-containers", { serverId }),
    refetchInterval: POLL_MS,
  });
}

const isActive = (c: DockerCleanup) => c.status === "QUEUED" || c.status === "RUNNING";

/** Cleanup history; checks every 3s while one is queued or running, then stops. */
export function useCleanups(serverId: string) {
  return useQuery({
    queryKey: monitoringKeys.cleanups(serverId),
    queryFn: () => api.get<DockerCleanup[]>("/docker-cleanups", { serverId }),
    refetchInterval: (q) => (q.state.data?.some(isActive) ? 3000 : false),
  });
}

/**
 * What a cleanup would free, asked live over SSH (a few seconds). Only runs
 * while the cleanup modal is open, never cached for later: the answer goes
 * stale the moment anything on the server changes.
 */
export function useCleanupPreview(serverId: string, enabled: boolean) {
  return useQuery({
    queryKey: monitoringKeys.preview(serverId),
    queryFn: () => api.get<CleanupPreview>("/docker-cleanups/preview", { serverId }),
    enabled,
    retry: false,
    gcTime: 0,
    staleTime: 0,
  });
}

export function useStartCleanup(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<DockerCleanup>("/docker-cleanups", { serverId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: monitoringKeys.cleanups(serverId) }),
  });
}

/** After a cleanup finishes, the disk numbers it changed are worth re-reading. */
export function useRefreshAfterCleanup(serverId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      [monitoringKeys.metrics(serverId), monitoringKeys.containers(serverId), serverKeys.all].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );
}
