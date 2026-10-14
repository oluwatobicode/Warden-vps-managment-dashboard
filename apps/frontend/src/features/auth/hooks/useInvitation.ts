import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  AcceptInviteInput,
  DeclineInviteInput,
  SessionUser,
} from "shared-types";
import { axiosInstance, unwrap } from "../../../api/axiosinstance";
import type { ApiEnvelope } from "../../../types/api";
import { authKeys } from "./useMe";

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AcceptInviteInput) =>
      unwrap(
        await axiosInstance.post<ApiEnvelope<SessionUser>>(
          "/auth/invitations/accept",
          input,
        ),
      ),
    onSuccess: (user) => queryClient.setQueryData(authKeys.me, user),
  });
}

export function useDeclineInvite() {
  return useMutation({
    mutationFn: (input: DeclineInviteInput) =>
      axiosInstance.post("/auth/invitations/decline", input),
  });
}
