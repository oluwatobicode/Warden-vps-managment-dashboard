import { useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "../../../api/axiosinstance";
import { authKeys } from "./useMe";

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => axiosInstance.post("/auth/logout"),
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData(authKeys.me, null);
    },
  });
}
