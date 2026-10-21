import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BackupStorageStatus, DatabaseBackup, DatabaseInfo, RestoreBackupInput, SaveBackupStorageInput, Service, UpdateBackupSettingsInput } from "shared-types";
import { api, axiosInstance, unwrap } from "../../../api/axiosinstance";
import type { ApiEnvelope } from "../../../types/api";
import { databaseKeys } from "./useDatabases";

export const backupKeys = {
  list: (serviceId: string) => ["database-backups", serviceId] as const,
  storage: ["backup-storage"] as const,
};

const running = (list: DatabaseBackup[] | undefined) => !!list?.some((b) => b.status === "QUEUED" || b.status === "RUNNING");

/** A database's backups, newest first. Checks every 2s while one is running. */
export function useBackups(serviceId: string) {
  return useQuery({
    queryKey: backupKeys.list(serviceId),
    queryFn: () => api.get<DatabaseBackup[]>("/database-backups", { serviceId }),
    refetchInterval: (q) => (running(q.state.data) ? 2000 : false),
  });
}

export function useBackupNow(serviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<DatabaseBackup>("/database-backups", { serviceId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: backupKeys.list(serviceId) }),
  });
}

/** The restore is logged as a deployment, so the database's info (which polls while it runs) is what shows progress. */
export function useRestoreBackup(serviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ backupId, ...input }: RestoreBackupInput & { backupId: string }) => api.post<Service>(`/database-backups/${backupId}/restore`, input),
    onSuccess: () =>
      Promise.all([["services"], databaseKeys.info(serviceId), ["dashboard"]].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}

export function useUpdateBackupSettings(serviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBackupSettingsInput) => api.patch<DatabaseInfo>(`/databases/${serviceId}/backup-settings`, input),
    onSuccess: (info) => queryClient.setQueryData(databaseKeys.info(serviceId), info),
  });
}

/**
 * A plain link, not an axios call: a dump can be gigabytes, and the browser
 * streams it to disk itself. The cheap call first refreshes the session if
 * the 15-minute access cookie has expired, so the link doesn't land on a 401.
 */
export async function downloadBackup(backupId: string) {
  await api.get("/auth/me");
  const a = document.createElement("a");
  a.href = `${import.meta.env.VITE_API_URL}/database-backups/${backupId}/download`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function useBackupStorage() {
  return useQuery({ queryKey: backupKeys.storage, queryFn: () => api.get<BackupStorageStatus>("/backup-storage") });
}

/** Where backups go changes what every database page says. */
function useStorageSaved() {
  const queryClient = useQueryClient();
  return (status: BackupStorageStatus) => {
    queryClient.setQueryData(backupKeys.storage, status);
    return queryClient.invalidateQueries({ queryKey: ["databases"] });
  };
}

export function useSaveBackupStorage() {
  const saved = useStorageSaved();
  return useMutation({ mutationFn: (input: SaveBackupStorageInput) => api.put<BackupStorageStatus>("/backup-storage", input), onSuccess: saved });
}

/** DELETE /backup-storage answers with where backups go now (not the usual empty 204). */
export function useRemoveBackupStorage() {
  const saved = useStorageSaved();
  return useMutation({
    mutationFn: async () => unwrap(await axiosInstance.delete<ApiEnvelope<BackupStorageStatus>>("/backup-storage")),
    onSuccess: saved,
  });
}
