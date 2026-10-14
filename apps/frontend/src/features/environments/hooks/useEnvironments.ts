import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateEnvironmentInput,
  Environment,
  UpdateEnvironmentInput,
} from "shared-types";
import { api } from "../../../api/axiosinstance";
import { projectKeys } from "../../projects/hooks/useProjects";

export const environmentKeys = {
  list: (projectId: string) => ["environments", { projectId }] as const,
};

export function useEnvironments(projectId: string) {
  return useQuery({
    queryKey: environmentKeys.list(projectId),
    queryFn: () => api.get<Environment[]>("/environments", { projectId }),
  });
}

function useRefresh(projectId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: environmentKeys.list(projectId),
      }),
      queryClient.invalidateQueries({ queryKey: projectKeys.all }),
    ]);
}

export function useCreateEnvironment(projectId: string) {
  const refresh = useRefresh(projectId);
  return useMutation({
    mutationFn: (input: Omit<CreateEnvironmentInput, "projectId">) =>
      api.post<Environment>("/environments", { ...input, projectId }),
    onSuccess: refresh,
  });
}

export function useUpdateEnvironment(projectId: string) {
  const refresh = useRefresh(projectId);
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateEnvironmentInput;
    }) => api.patch<Environment>(`/environments/${id}`, input),
    onSuccess: refresh,
  });
}

export function useDeleteEnvironment(projectId: string) {
  const refresh = useRefresh(projectId);
  return useMutation({
    mutationFn: (id: string) => api.delete(`/environments/${id}`),
    onSuccess: refresh,
  });
}
