import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Avatar,
  AvatarStyle,
  ChangePasswordInput,
  SessionUser,
  SessionsSummary,
  SetPasswordInput,
  UpdateProfileInput,
} from "shared-types";
import { api } from "../../../api/axiosinstance";
import { authKeys } from "../../auth/hooks/useMe";
import { avatarUri, styleCredit } from "../avatar";

export const accountKeys = {
  sessions: ["account", "sessions"] as const,
  avatar: (a: Avatar) => ["avatar", a.style, a.seed] as const,
  credit: (style: AvatarStyle) => ["avatar-credit", style] as const,
};

/** The SVG for one avatar. Same style + seed is the same picture forever, so it's cached for good. */
export function useAvatarUri(avatar: Avatar | undefined) {
  return useQuery({
    queryKey: avatar ? accountKeys.avatar(avatar) : ["avatar", "none"],
    queryFn: () => avatarUri(avatar!.style, avatar!.seed),
    enabled: !!avatar,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });
}

export function useStyleCredit(style: AvatarStyle) {
  return useQuery({ queryKey: accountKeys.credit(style), queryFn: () => styleCredit(style), staleTime: Infinity });
}

/** Name and/or avatar. The answer is the new session user, so the whole app updates at once. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => api.patch<SessionUser>("/account/profile", input),
    onSuccess: (user) => queryClient.setQueryData(authKeys.me, user),
  });
}

/** Changing or adding a password signs out the other sessions, so their count changes too. */
function useRefreshAfterPassword() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([queryClient.invalidateQueries({ queryKey: authKeys.me }), queryClient.invalidateQueries({ queryKey: accountKeys.sessions })]);
}

export function useChangePassword() {
  const refresh = useRefreshAfterPassword();
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => api.post("/account/password", input),
    onSuccess: refresh,
  });
}

export function useRequestPasswordCode() {
  return useMutation({ mutationFn: () => api.post("/account/password/code") });
}

export function useSetPassword() {
  const refresh = useRefreshAfterPassword();
  return useMutation({
    mutationFn: (input: SetPasswordInput) => api.post("/account/password/set", input),
    onSuccess: refresh,
  });
}

export function useSessions() {
  return useQuery({ queryKey: accountKeys.sessions, queryFn: () => api.get<SessionsSummary>("/account/sessions") });
}

export function useSignOutOthers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete("/account/sessions/others"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.sessions }),
  });
}
