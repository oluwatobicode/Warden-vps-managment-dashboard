import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { LoginInput } from "shared-types";
import { axiosInstance } from "../../../api/axiosinstance";
import { authKeys } from "./useMe";

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => axiosInstance.post("/auth/login", input),
    onSuccess: () => queryClient.refetchQueries({ queryKey: authKeys.me }),
  });
}
