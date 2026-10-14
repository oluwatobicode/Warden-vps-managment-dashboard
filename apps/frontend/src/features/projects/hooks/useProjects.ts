import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateProjectInput, Project, ProjectDetail } from "shared-types";
import { axiosInstance, unwrap } from "../../../api/axiosinstance";
import type { ApiEnvelope } from "../../../types/api";

export const projectKeys = {
  all: ["projects"] as const,
  detail: (id: string) => ["projects", id] as const,
};

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: async () =>
      unwrap(await axiosInstance.get<ApiEnvelope<Project[]>>("/projects")),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: async () =>
      unwrap(
        await axiosInstance.get<ApiEnvelope<ProjectDetail>>(`/projects/${id}`),
      ),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProjectInput) =>
      unwrap(
        await axiosInstance.post<ApiEnvelope<ProjectDetail>>(
          "/projects",
          input,
        ),
      ),
    onSuccess: (project) => {
      queryClient.setQueryData(projectKeys.detail(project.id), project);
      return queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}
