import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProxyApplyResult, ProxyCheckResult, ProxyConfigView, ProxyForm, SaveProxyConfigInput } from "shared-types";
import { api } from "../../../api/axiosinstance";

export const proxyKeys = {
  view: (serverId: string) => ["proxy-config", serverId] as const,
  check: (serverId: string, form: ProxyForm, raw: string) => ["proxy-config", serverId, "check", form, raw] as const,
};

/** The server's warden.yml, its versions and the routes Traefik serves right now. */
export function useProxyConfig(serverId: string) {
  return useQuery({ queryKey: proxyKeys.view(serverId), queryFn: () => api.get<ProxyConfigView>(`/servers/${serverId}/proxy-config`) });
}

/** A value that only changes after it stopped changing for `ms` (checks while typing, not on every key). */
export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** The api's check of a draft (YAML, Traefik's schema, names, references), re-run as you edit. Nothing is applied. */
export function useProxyCheck(serverId: string, form: ProxyForm, raw: string, enabled: boolean) {
  return useQuery({
    queryKey: proxyKeys.check(serverId, form, raw),
    queryFn: () => api.post<ProxyCheckResult>(`/servers/${serverId}/proxy-config/check`, { form, raw }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useApplyProxy(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveProxyConfigInput) => api.put<ProxyApplyResult>(`/servers/${serverId}/proxy-config`, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: proxyKeys.view(serverId) }),
  });
}

export function useRevertProxy(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ versionId, baseVersionId }: { versionId: string; baseVersionId: string | null }) =>
      api.post<ProxyApplyResult>(`/servers/${serverId}/proxy-config/revert/${versionId}`, { baseVersionId }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: proxyKeys.view(serverId) }),
  });
}
