import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../api/axiosinstance";

export interface GithubStatus {
  /** This Warden has GitHub App keys in its .env. */
  configured: boolean;
  appSlug: string | null;
  installations: Array<{ id: string; accountLogin: string; accountType: string; serviceCount: number; createdAt: string }>;
}

export interface GithubRepo {
  id: number;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
}

export const githubKeys = {
  status: ["github", "status"] as const,
  repos: (installationId: string) => ["github", "repos", installationId] as const,
  branches: (installationId: string, repo: string) => ["github", "branches", installationId, repo] as const,
};

export function useGithubStatus() {
  return useQuery({ queryKey: githubKeys.status, queryFn: () => api.get<GithubStatus>("/github/status") });
}

/** "Connect GitHub": the api remembers who asked, then the browser goes to GitHub and comes back to Settings → GitHub. */
export function useConnectGithub() {
  return useMutation({
    mutationFn: () => api.post<{ url: string }>("/github/install"),
    onSuccess: ({ url }) => window.location.assign(url),
  });
}

export function useDisconnectGithub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/github/installations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["github"] }),
  });
}

export function useGithubRepos(installationId: string | null) {
  return useQuery({
    queryKey: githubKeys.repos(installationId ?? ""),
    queryFn: () => api.get<GithubRepo[]>(`/github/installations/${installationId}/repos`),
    enabled: !!installationId,
    staleTime: 60_000,
  });
}

export function useGithubBranches(installationId: string | null, repo: string | null) {
  return useQuery({
    queryKey: githubKeys.branches(installationId ?? "", repo ?? ""),
    queryFn: () => api.get<string[]>(`/github/installations/${installationId}/branches`, { repo: repo! }),
    enabled: !!installationId && !!repo,
    staleTime: 60_000,
  });
}
