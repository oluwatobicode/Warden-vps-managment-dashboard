import { useQuery } from "@tanstack/react-query";
import type { AuthOutcome } from "shared-types";
import { axiosInstance, unwrap } from "../../../api/axiosinstance";
import type { ApiEnvelope } from "../../../types/api";

export function useVerifyMagicLink(token: string | null) {
  return useQuery({
    queryKey: ["auth", "verify", token],
    queryFn: async () =>
      unwrap(
        await axiosInstance.get<ApiEnvelope<AuthOutcome>>("/auth/verify", {
          params: { token },
        }),
      ),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
