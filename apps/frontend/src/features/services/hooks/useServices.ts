import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AssignServerInput, CreateServiceInput, Service, UpdateServiceInput } from "shared-types";
import { api, axiosInstance, unwrap } from "../../../api/axiosinstance";
import type { ApiEnvelope } from "../../../types/api";
import { projectKeys } from "../../projects/hooks/useProjects";

export const serviceKeys = {
  list: (environmentId: string) => ["services", { environmentId }] as const,
  detail: (id: string) => ["services", id] as const,
};

export function useServices(environmentId: string | undefined) {
  return useQuery({
    queryKey: serviceKeys.list(environmentId ?? ""),
    queryFn: () => api.get<Service[]>("/services", { environmentId: environmentId! }),
    enabled: !!environmentId,
  });
}

export function useService(id: string, enabled = true) {
  return useQuery({
    queryKey: serviceKeys.detail(id),
    queryFn: () => api.get<Service>(`/services/${id}`),
    enabled: enabled && !!id,
  });
}

// A service changes its environment's list, the env + project counts and the
// status rollups, and server service-counts: refresh all of them.
function useRefresh() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      [["services"], ["environments"], projectKeys.all, ["servers"]].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
}

export function useCreateService() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: CreateServiceInput) => api.post<Service>("/services", input),
    onSuccess: refresh,
  });
}

export function useUpdateService(id: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: UpdateServiceInput) => api.patch<Service>(`/services/${id}`, input),
    onSuccess: refresh,
  });
}

/** PATCH /services/:id/server: assign to a DEPLOY server, or null to unassign. */
export function useAssignServer(id: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: AssignServerInput) => api.patch<Service>(`/services/${id}/server`, input),
    onSuccess: refresh,
  });
}

/** Refused (409) while the service is assigned to a server. */
export function useDeleteService(id: string) {
  const queryClient = useQueryClient();
  const refresh = useRefresh();
  return useMutation({
    // force: delete even though the server can't be reached; the answer lists what's left there.
    mutationFn: async (force: boolean = false) =>
      unwrap(await axiosInstance.delete<ApiEnvelope<{ leftovers: Array<{ serverName: string; serviceName: string; command: string }> }>>(`/services/${id}${force ? "?force=true" : ""}`)),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: serviceKeys.detail(id) });
      return refresh();
    },
  });
}
