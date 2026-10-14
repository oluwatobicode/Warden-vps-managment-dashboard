import { useMutation } from "@tanstack/react-query";
import type { ForgotPasswordInput, ResetPasswordInput } from "shared-types";
import { axiosInstance } from "../../../api/axiosinstance";

export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: ForgotPasswordInput) =>
      axiosInstance.post("/auth/forgot-password", input),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: ResetPasswordInput) =>
      axiosInstance.post("/auth/reset-password", input),
  });
}
