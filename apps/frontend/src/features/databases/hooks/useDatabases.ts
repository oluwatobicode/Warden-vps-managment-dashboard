import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateDatabaseInput, DatabaseConnection, DatabaseInfo, DeleteDatabaseInput, Service } from "shared-types";
import { api } from "../../../api/axiosinstance";

export const databaseKeys = { info: (serviceId: string) => ["databases", serviceId] as const };

const IN_PROGRESS = new Set(["QUEUED", "BUILDING", "DEPLOYING", "HEALTH_CHECK"]);
export const isInProgress = (info: DatabaseInfo | undefined) => !!info?.latestDeployment && IN_PROGRESS.has(info.latestDeployment.status);

/** A database's details and its latest create/restart. Checks every 2s while one is running, then stops. */
export function useDatabase(serviceId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: databaseKeys.info(serviceId),
    queryFn: () => api.get<DatabaseInfo>(`/databases/${serviceId}`),
    refetchInterval: (q) => (isInProgress(q.state.data) ? 2000 : false),
  });
  // When a create/restart finishes, the service's status changed too (header
  // pill, lists, canvas, Home): refresh them once.
  const busy = isInProgress(query.data);
  const wasBusy = useRef(busy);
  useEffect(() => {
    if (wasBusy.current && !busy) {
      void queryClient.invalidateQueries({ queryKey: ["services"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
    wasBusy.current = busy;
  }, [busy, queryClient]);
  return query;
}

/** A database changes the services list, its variables, the project's counts and Home. */
function useRefresh() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      [["services"], ["projects"], ["environments"], ["variables"], ["dashboard"], ["databases"]].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );
}

export function useCreateDatabase() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (input: CreateDatabaseInput) => api.post<Service>("/databases", input), onSuccess: refresh });
}

export function useRestartDatabase(serviceId: string) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: () => api.post<Service>(`/databases/${serviceId}/restart`), onSuccess: refresh });
}

export function useDeleteDatabase(serviceId: string) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (input: DeleteDatabaseInput) => api.delete(`/databases/${serviceId}`, input), onSuccess: refresh });
}

/** Reveal is audit-logged; nothing is cached, the string only lives in the component while shown. */
export function useRevealConnection(serviceId: string) {
  return useMutation({ mutationFn: () => api.get<DatabaseConnection>(`/databases/${serviceId}/connection`) });
}
