import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateNotificationChannelInput,
  NotificationChannel,
  NotificationTestResult,
  RevealedWebhook,
  UpdateNotificationChannelInput,
} from "shared-types";
import { api } from "../../../api/axiosinstance";

export const channelKeys = { all: ["notification-channels"] as const };

export function useNotificationChannels() {
  return useQuery({
    queryKey: channelKeys.all,
    queryFn: () => api.get<NotificationChannel[]>("/notification-channels"),
  });
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: channelKeys.all });
}

export function useCreateChannel() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: CreateNotificationChannelInput) =>
      api.post<NotificationChannel>("/notification-channels", input),
    onSuccess: refresh,
  });
}

export function useUpdateChannel() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateNotificationChannelInput;
    }) => api.patch<NotificationChannel>(`/notification-channels/${id}`, input),
    onSuccess: refresh,
  });
}

export function useDeleteChannel() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/notification-channels/${id}`),
    onSuccess: refresh,
  });
}

export function useTestChannel() {
  return useMutation({
    mutationFn: (id: string) =>
      api.post<NotificationTestResult>(`/notification-channels/${id}/test`),
  });
}

export function useRevealChannel() {
  return useMutation({
    mutationFn: (id: string) =>
      api.get<RevealedWebhook>(`/notification-channels/${id}/reveal`),
  });
}
