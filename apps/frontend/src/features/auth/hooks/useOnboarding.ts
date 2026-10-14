import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  EmailOnboardingInput,
  OAuthOnboardingInput,
  SessionUser,
} from "shared-types";
import { axiosInstance, unwrap } from "../../../api/axiosinstance";
import type { ApiEnvelope } from "../../../types/api";
import { authKeys } from "./useMe";

type Input =
  | { provider: "EMAIL"; body: EmailOnboardingInput }
  | { provider: "OAUTH"; body: OAuthOnboardingInput };

export function useOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ provider, body }: Input) =>
      unwrap(
        await axiosInstance.post<ApiEnvelope<SessionUser>>(
          provider === "EMAIL" ? "/auth/onboarding" : "/auth/onboarding/oauth",
          body,
        ),
      ),

    onSuccess: (user) => queryClient.setQueryData(authKeys.me, user),
  });
}
