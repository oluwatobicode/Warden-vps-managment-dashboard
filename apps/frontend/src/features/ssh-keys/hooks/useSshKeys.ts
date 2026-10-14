import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateSshKeyInput, SshKey } from "shared-types";
import { api } from "../../../api/axiosinstance";

export const sshKeyKeys = { all: ["ssh-keys"] as const };

export function useSshKeys() {
  return useQuery({
    queryKey: sshKeyKeys.all,
    queryFn: () => api.get<SshKey[]>("/ssh-keys"),
  });
}

export function useCreateSshKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSshKeyInput) =>
      api.post<SshKey>("/ssh-keys", input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: sshKeyKeys.all }),
  });
}

export function useDeleteSshKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/ssh-keys/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: sshKeyKeys.all }),
  });
}
