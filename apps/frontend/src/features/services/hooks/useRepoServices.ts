import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateFromRepoInput, CreateFromRepoResult, InspectRepoQuery, RepoInspection } from "shared-types";
import { api } from "../../../api/axiosinstance";
import { projectKeys } from "../../projects/hooks/useProjects";

/** Read a repo through GitHub (no clone) and list the apps in it, with suggested settings. */
export function useInspectRepo() {
  return useMutation({
    mutationFn: (q: InspectRepoQuery) =>
      api.get<RepoInspection>("/github/inspect", {
        repo: q.repo,
        ...(q.installationId ? { installationId: q.installationId } : {}),
        ...(q.branch ? { branch: q.branch } : {}),
      }),
  });
}

/** Create the picked apps as services (and start their first deploys). */
export function useCreateFromRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFromRepoInput) => api.post<CreateFromRepoResult>("/services/from-repo", input),
    onSuccess: () =>
      Promise.all(
        [["services"], ["environments"], projectKeys.all, ["servers"], ["deployments"], ["dashboard"]].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ),
  });
}

/** "https://github.com/acme/api.git", "github.com/acme/api", "acme/api" → "acme/api". */
export function parseRepo(input: string): string | null {
  const m = input.trim().match(/^(?:https?:\/\/)?(?:www\.)?(?:github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}
