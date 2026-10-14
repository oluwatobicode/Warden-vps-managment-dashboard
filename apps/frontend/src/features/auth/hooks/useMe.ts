import { useQuery } from "@tanstack/react-query";
import type { SessionUser } from "shared-types";
import { axiosInstance, unwrap } from "../../../api/axiosinstance";
import type { ApiEnvelope } from "../../../types/api";
import { apiStatus } from "../../../utils/apiMessage";

export const authKeys = {
  me: ["auth", "me"] as const,
};

async function fetchMe(): Promise<SessionUser | null> {
  try {
    return unwrap(
      await axiosInstance.get<ApiEnvelope<SessionUser>>("/auth/me"),
    );
  } catch (e) {
    if (apiStatus(e) === 401) return null;
    throw e;
  }
}

export function useMe() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: fetchMe,
    staleTime: 5 * 60_000,
  });
}
