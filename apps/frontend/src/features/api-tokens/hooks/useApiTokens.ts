import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ApiToken,
  CreateApiTokenInput,
  CreatedApiToken,
} from "shared-types";
import { api } from "../../../api/axiosinstance";

export const tokenKeys = { all: ["api-tokens"] as const };

export function useApiTokens(enabled: boolean) {
  return useQuery({
    queryKey: tokenKeys.all,
    queryFn: () => api.get<ApiToken[]>("/api-tokens"),
    enabled,
  });
}

export function useCreateApiToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateApiTokenInput) =>
      api.post<CreatedApiToken>("/api-tokens", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tokenKeys.all }),
  });
}

export function useRevokeApiToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api-tokens/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tokenKeys.all }),
  });
}
