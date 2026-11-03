import { useMutation, useQuery } from "@tanstack/react-query";
import type { SupportRequestInput, SupportStatus } from "shared-types";
import { api } from "../../../api/axiosinstance";

/** Whether this Warden has a support inbox (MAIL_SUPPORT). Doesn't change while it runs. */
export function useSupportStatus() {
  return useQuery({
    queryKey: ["support"],
    queryFn: () => api.get<SupportStatus>("/support"),
    staleTime: Infinity,
  });
}

/** Multipart: the text fields, plus each screenshot as a file named `images`. */
export function useSendSupport() {
  return useMutation({
    mutationFn: ({ input, images }: { input: SupportRequestInput; images: File[] }) => {
      const form = new FormData();
      form.append("category", input.category);
      form.append("subject", input.subject);
      form.append("message", input.message);
      if (input.page) form.append("page", input.page);
      for (const file of images) form.append("images", file);
      return api.post<{ sent: true }>("/support", form);
    },
  });
}
