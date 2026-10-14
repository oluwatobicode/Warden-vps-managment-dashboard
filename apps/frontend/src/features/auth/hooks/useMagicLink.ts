import { useMutation } from "@tanstack/react-query";
import type { MagicLinkRequest } from "shared-types";
import { axiosInstance } from "../../../api/axiosinstance";

export function useMagicLink() {
  return useMutation({
    mutationFn: (input: MagicLinkRequest) =>
      axiosInstance.post("/auth/magic-link", input),
  });
}
