import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ConnectionTest,
  CreateServerInput,
  Server,
  UpdateServerInput,
} from "shared-types";
import { api } from "../../../api/axiosinstance";

export const serverKeys = {
  all: ["servers"] as const,
  detail: (id: string) => ["servers", id] as const,
};

export function useServers() {
  return useQuery({
    queryKey: serverKeys.all,
    queryFn: () => api.get<Server[]>("/servers"),
  });
}

export function useServer(id: string) {
  return useQuery({
    queryKey: serverKeys.detail(id),
    queryFn: () => api.get<Server>(`/servers/${id}`),
  });
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      [serverKeys.all, ["ssh-keys"]].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );
}

export function useCreateServer() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: CreateServerInput) =>
      api.post<Server>("/servers", input),
    onSuccess: refresh,
  });
}

export function useUpdateServer(id: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: UpdateServerInput) =>
      api.patch<Server>(`/servers/${id}`, input),
    onSuccess: refresh,
  });
}

export function useDeleteServer(id: string) {
  const queryClient = useQueryClient();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: () => api.delete(`/servers/${id}`),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: serverKeys.detail(id) });
      return refresh();
    },
  });
}

export function useTestConnection(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ConnectionTest>(`/servers/${id}/test`),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: serverKeys.all }),
  });
}
