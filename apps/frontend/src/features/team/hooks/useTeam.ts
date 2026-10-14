import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Invitation, InviteMemberInput, Member, Role } from "shared-types";
import { api } from "../../../api/axiosinstance";

export const teamKeys = {
  members: ["team", "members"] as const,
  invitations: ["team", "invitations"] as const,
};

export function useMembers() {
  return useQuery({
    queryKey: teamKeys.members,
    queryFn: () => api.get<Member[]>("/team/members"),
  });
}

export function useInvitations(enabled: boolean) {
  return useQuery({
    queryKey: teamKeys.invitations,
    queryFn: () => api.get<Invitation[]>("/team/invitations"),
    enabled,
  });
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["team"] });
}

export function useInviteMember() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: InviteMemberInput) =>
      api.post<Invitation>("/team/invitations", input),
    onSuccess: refresh,
  });
}

export function useResendInvitation() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<Invitation>(`/team/invitations/${id}/resend`),
    onSuccess: refresh,
  });
}

export function useRevokeInvitation() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/team/invitations/${id}`),
    onSuccess: refresh,
  });
}

export function useUpdateMemberRole() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      api.patch<Member>(`/team/members/${id}/role`, { role }),
    onSuccess: refresh,
  });
}

export function useRemoveMember() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/team/members/${id}`),
    onSuccess: refresh,
  });
}
