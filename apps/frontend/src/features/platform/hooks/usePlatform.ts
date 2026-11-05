import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import type {
  PlatformDeployFilter,
  PlatformDeployPage,
  PlatformHealth,
  PlatformOrgPage,
  PlatformOrgSort,
  PlatformOverview,
  PlatformUserDetail,
  PlatformUserEmail,
  PlatformUserPage,
  PlatformUserSort,
} from "shared-types";
import { api } from "../../../api/axiosinstance";

export const platformKeys = {
  all: ["platform"] as const,
  overview: ["platform", "overview"] as const,
  health: ["platform", "health"] as const,
  orgs: (sort: PlatformOrgSort) => ["platform", "orgs", sort] as const,
  users: (sort: PlatformUserSort, q: string) => ["platform", "users", sort, q] as const,
  user: (id: string) => ["platform", "user", id] as const,
  deploys: (status: PlatformDeployFilter) => ["platform", "deploys", status] as const,
};

/** Every number is live from Postgres; a minute old is fine. The refresh button invalidates platformKeys.all. */
const STALE = 60_000;

export function usePlatformOverview(enabled = true) {
  return useQuery({
    queryKey: platformKeys.overview,
    enabled,
    queryFn: () => api.get<PlatformOverview>("/platform/overview"),
    staleTime: STALE,
    retry: false,
  });
}

export function usePlatformHealth(enabled = true) {
  return useQuery({
    queryKey: platformKeys.health,
    enabled,
    queryFn: () => api.get<PlatformHealth>("/platform/health"),
    staleTime: STALE,
    retry: false,
  });
}

/** 50 orgs a page, "Load more" reads the next with the page's cursor. */
export function usePlatformOrgs(sort: PlatformOrgSort) {
  return useInfiniteQuery({
    queryKey: platformKeys.orgs(sort),
    queryFn: ({ pageParam }) =>
      api.get<PlatformOrgPage>("/platform/orgs", { sort, ...(pageParam && { cursor: pageParam }) }),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: STALE,
    retry: false,
  });
}

/** 50 users a page; `q` (2+ characters, else ignored) searches first + last name on the server. */
export function usePlatformUsers(sort: PlatformUserSort, q: string) {
  const search = q.trim().length >= 2 ? q.trim() : "";
  return useInfiniteQuery({
    queryKey: platformKeys.users(sort, search),
    queryFn: ({ pageParam }) =>
      api.get<PlatformUserPage>("/platform/users", { sort, ...(search && { q: search }), ...(pageParam && { cursor: pageParam }) }),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: STALE,
    retry: false,
  });
}

export function usePlatformUser(id: string, enabled = true) {
  return useQuery({
    queryKey: platformKeys.user(id),
    enabled,
    queryFn: () => api.get<PlatformUserDetail>(`/platform/users/${id}`),
    staleTime: STALE,
    retry: false,
  });
}

/**
 * Reveals one user's email. A mutation on purpose: every call writes an access-log
 * row on the api, and the email stays in this component's state only, never in
 * the query cache (so Refresh or another page never re-reads it).
 */
export function useRevealEmail(id: string) {
  return useMutation({
    mutationFn: () => api.post<PlatformUserEmail>(`/platform/users/${id}/email`),
  });
}

/** Deploys across every org, newest first, 50 a page. */
export function usePlatformDeploys(status: PlatformDeployFilter) {
  return useInfiniteQuery({
    queryKey: platformKeys.deploys(status),
    queryFn: ({ pageParam }) =>
      api.get<PlatformDeployPage>("/platform/deploys", { status, ...(pageParam && { cursor: pageParam }) }),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: STALE,
    retry: false,
  });
}
