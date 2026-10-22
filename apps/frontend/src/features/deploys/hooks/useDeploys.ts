import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import {
  DEPLOY_SOCKET,
  type AddDomainInput,
  type DeployInfo,
  type DeployLogChunk,
  type Deployment,
  type DeploymentDetail,
  type ServiceDomain,
  type TriggerDeployInput,
  type UpdateDeploySettingsInput,
} from "shared-types";
import { api, axiosInstance } from "../../../api/axiosinstance";

export const deployKeys = {
  list: (serviceId: string) => ["deployments", "service", serviceId] as const,
  detail: (id: string) => ["deployments", id] as const,
  info: (serviceId: string) => ["deploy-info", serviceId] as const,
  proxy: (serverId: string) => ["proxy", serverId] as const,
};

const RUNNING = new Set(["QUEUED", "BUILDING", "DEPLOYING", "HEALTH_CHECK"]);
export const isRunning = (status: string | undefined) => !!status && RUNNING.has(status);

/** A service's deploys, newest first. Checks every 3s while one is running. */
export function useDeployments(serviceId: string) {
  return useQuery({
    queryKey: deployKeys.list(serviceId),
    queryFn: () => api.get<Deployment[]>("/deployments", { serviceId }),
    refetchInterval: (q) => (q.state.data?.some((d) => isRunning(d.status)) ? 3000 : false),
  });
}

/** One deploy and its steps. Checks every 2s while it runs; refreshes the lists when it ends. */
export function useDeployment(id: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: deployKeys.detail(id),
    queryFn: () => api.get<DeploymentDetail>(`/deployments/${id}`),
    refetchInterval: (q) => (isRunning(q.state.data?.status) ? 2000 : false),
  });
  const running = isRunning(query.data?.status);
  const was = useRef(running);
  useEffect(() => {
    if (was.current && !running) {
      for (const queryKey of [["deployments"], ["services"], ["dashboard"], ["deploy-info"]]) void queryClient.invalidateQueries({ queryKey });
    }
    was.current = running;
  }, [running, queryClient]);
  return query;
}

/**
 * A deploy's output: the saved chunks first, then new ones live over
 * Socket.io (the api checks the deploy belongs to this org). Chunks are kept
 * by `seq`, so a chunk that arrives both ways is shown once, in order.
 */
export function useDeployLog(id: string, live: boolean) {
  const [chunks, setChunks] = useState<Map<number, string>>(new Map());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let stopped = false;
    const add = (list: DeployLogChunk[]) =>
      setChunks((prev) => {
        const next = new Map(prev);
        for (const c of list) next.set(c.seq, c.text);
        return next;
      });
    const loadSaved = () => api.get<DeployLogChunk[]>(`/deployments/${id}/logs`).then((l) => !stopped && add(l)).catch(() => undefined);
    void loadSaved();
    if (!live) return () => void (stopped = true);

    // The socket lives under the api's address (/api/socket.io), so the access cookie goes with it.
    const base = new URL(import.meta.env.VITE_API_URL, window.location.origin);
    const socket = io(`${base.origin}${DEPLOY_SOCKET.namespace}`, { path: `${base.pathname.replace(/\/$/, "")}/socket.io`, withCredentials: true, transports: ["websocket"] });
    socket.on("connect", () => {
      setConnected(true);
      socket.emit(DEPLOY_SOCKET.watch, id);
      void loadSaved(); // anything written before the watch started
    });
    socket.on("disconnect", () => setConnected(false));
    // The 15-minute access cookie ran out: refresh it with a normal call, then try again.
    socket.on("unauthorized", () => void axiosInstance.get("/auth/me").finally(() => !stopped && socket.connect()));
    socket.on(DEPLOY_SOCKET.log, (m: DeployLogChunk & { deploymentId: string }) => m.deploymentId === id && add([m]));
    return () => {
      stopped = true;
      socket.close();
    };
  }, [id, live]);

  const text = [...chunks.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, t]) => t)
    .join("");
  return { text, connected };
}

/** Everything that changes when a deploy starts or ends. */
function useRefresh(serviceId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([deployKeys.list(serviceId), ["services"], ["dashboard"]].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export function useTriggerDeploy(serviceId: string) {
  const refresh = useRefresh(serviceId);
  return useMutation({ mutationFn: (input: Omit<TriggerDeployInput, "serviceId">) => api.post<Deployment>("/deployments", { serviceId, ...input }), onSuccess: refresh });
}

export function useRollback(serviceId: string) {
  const refresh = useRefresh(serviceId);
  return useMutation({ mutationFn: (deploymentId: string) => api.post<Deployment>(`/deployments/${deploymentId}/rollback`), onSuccess: refresh });
}

export function useCancelDeploy(serviceId: string) {
  const queryClient = useQueryClient();
  const refresh = useRefresh(serviceId);
  return useMutation({
    mutationFn: (deploymentId: string) => api.post<{ message: string }>(`/deployments/${deploymentId}/cancel`),
    onSuccess: (_r, id) => Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: deployKeys.detail(id) })]),
  });
}

export function useDeployInfo(serviceId: string) {
  return useQuery({ queryKey: deployKeys.info(serviceId), queryFn: () => api.get<DeployInfo>(`/services/${serviceId}/deploy-settings`) });
}

export function useUpdateDeploySettings(serviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateDeploySettingsInput) => api.patch<DeployInfo>(`/services/${serviceId}/deploy-settings`, input),
    onSuccess: (info) => {
      queryClient.setQueryData(deployKeys.info(serviceId), info);
      // Picking a GitHub repo also sets the service's repo address and branch.
      return queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });
}

export function useAddDomain(serviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (domain: string) => api.post<ServiceDomain>("/service-domains", { serviceId, domain } satisfies AddDomainInput),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: deployKeys.info(serviceId) }),
  });
}

export function useVerifyDomain(serviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<ServiceDomain & { dnsIps: string[] }>(`/service-domains/${id}/verify`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: deployKeys.info(serviceId) }),
  });
}

export function useRemoveDomain(serviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/service-domains/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: deployKeys.info(serviceId) }),
  });
}

interface ProxyStatus {
  installedAt: string | null;
  job: { state: string; failedReason: string | null } | null;
}

/** Traefik on a server: set up or not, and since when. */
export function useProxyStatus(serverId: string) {
  return useQuery({
    queryKey: deployKeys.proxy(serverId),
    queryFn: () => api.get<ProxyStatus>(`/servers/${serverId}/proxy`),
  });
}

/** A failed proxy setup, with the worker's own reason ("Port 80 is already used…"). */
export class ProxySetupError extends Error {}

/**
 * "Set up proxy": queue the job, then wait for the worker to finish it (up to
 * 3 minutes; the first time downloads Traefik). Fails with the job's reason.
 */
export function useSetupProxy(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { jobId } = await api.post<{ jobId: string }>(`/servers/${serverId}/proxy`);
      for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const s = await api.get<ProxyStatus>(`/servers/${serverId}/proxy`, { jobId });
        if (s.job?.state === "completed") return s;
        if (s.job?.state === "failed") throw new ProxySetupError(s.job.failedReason ?? "Setting up the proxy failed");
      }
      throw new ProxySetupError("The proxy setup is taking longer than 3 minutes. Check the server, then try again");
    },
    onSettled: () =>
      Promise.all([deployKeys.proxy(serverId), ["deploy-info"]].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}

/** Stop the live version (it stops serving; nothing is deleted) or start it again. */
export function useStopStart(serviceId: string) {
  const refresh = useRefresh(serviceId);
  return useMutation({
    mutationFn: (action: "stop" | "start") => api.post(`/services/${serviceId}/${action}`),
    onSuccess: refresh,
  });
}

