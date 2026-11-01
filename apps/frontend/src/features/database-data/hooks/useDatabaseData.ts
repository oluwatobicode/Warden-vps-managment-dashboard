import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  DataRows,
  DataTables,
  DeleteRedisKeysInput,
  DeleteRowsInput,
  InsertRowInput,
  RedisCommandInput,
  RedisCommandResult,
  RedisKeys,
  RedisValue,
  RowsChanged,
  RunQueryInput,
  RunQueryResult,
  SetRedisStringInput,
  UpdateRowInput,
} from "shared-types";
import { api } from "../../../api/axiosinstance";

/** One table page: which table, where, sorted how. */
export interface RowsView {
  schema: string;
  table: string;
  offset: number;
  limit: number;
  sort?: string;
  dir: "asc" | "desc";
}

export const dataKeys = {
  all: (serviceId: string) => ["database-data", serviceId] as const,
  tables: (serviceId: string) => ["database-data", serviceId, "tables"] as const,
  rows: (serviceId: string, v?: RowsView) => (v ? (["database-data", serviceId, "rows", v] as const) : (["database-data", serviceId, "rows"] as const)),
  keys: (serviceId: string, pattern?: string) => (pattern === undefined ? (["database-data", serviceId, "keys"] as const) : (["database-data", serviceId, "keys", pattern] as const)),
  value: (serviceId: string, key?: string) => (key === undefined ? (["database-data", serviceId, "value"] as const) : (["database-data", serviceId, "value", key] as const)),
};

/*
 * Every read opens an SSH connection and a bridge into the database, so
 * nothing here refetches on its own: reads happen when someone opens or
 * reloads a view, and after their own edits.
 */
const MANUAL = { staleTime: 30_000, refetchOnWindowFocus: false, retry: false } as const;

export function useDataTables(serviceId: string) {
  return useQuery({ queryKey: dataKeys.tables(serviceId), queryFn: () => api.get<DataTables>("/database-data/tables", { serviceId }), ...MANUAL });
}

export function useDataRows(serviceId: string, v: RowsView | null) {
  return useQuery({
    queryKey: dataKeys.rows(serviceId, v ?? undefined),
    queryFn: () =>
      api.get<DataRows>("/database-data/rows", {
        serviceId,
        schema: v!.schema,
        table: v!.table,
        offset: String(v!.offset),
        limit: String(v!.limit),
        dir: v!.dir,
        ...(v!.sort && { sort: v!.sort }),
      }),
    enabled: !!v,
    placeholderData: keepPreviousData,
    ...MANUAL,
  });
}

/** After anything that may have changed data: rows and tables (row counts, new tables) are read again. */
function useRefreshData(serviceId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: dataKeys.all(serviceId) });
}

export function useRunQuery(serviceId: string) {
  const refresh = useRefreshData(serviceId);
  return useMutation({
    mutationFn: (body: Omit<RunQueryInput, "serviceId">) => api.post<RunQueryResult>("/database-data/query", { serviceId, ...body }),
    onSuccess: (r, body) => {
      if (body.allowWrites && !r.needsConfirm) void refresh();
    },
  });
}

export function useUpdateRow(serviceId: string) {
  const refresh = useRefreshData(serviceId);
  return useMutation({
    mutationFn: (body: Omit<UpdateRowInput, "serviceId">) => api.patch<RowsChanged>("/database-data/rows", { serviceId, ...body }),
    onSuccess: () => void refresh(),
  });
}

export function useInsertRow(serviceId: string) {
  const refresh = useRefreshData(serviceId);
  return useMutation({
    mutationFn: (body: Omit<InsertRowInput, "serviceId">) => api.post<RowsChanged>("/database-data/rows", { serviceId, ...body }),
    onSuccess: () => void refresh(),
  });
}

export function useDeleteRows(serviceId: string) {
  const refresh = useRefreshData(serviceId);
  return useMutation({
    mutationFn: (body: Omit<DeleteRowsInput, "serviceId">) => api.post<RowsChanged>("/database-data/rows/delete", { serviceId, ...body }),
    onSuccess: () => void refresh(),
  });
}

/** Keys matching a pattern, ~100 per page (SCAN), "Load more" for the next. */
export function useRedisKeys(serviceId: string, pattern: string) {
  return useInfiniteQuery({
    queryKey: dataKeys.keys(serviceId, pattern),
    queryFn: ({ pageParam }) => api.get<RedisKeys>("/database-data/keys", { serviceId, pattern, cursor: pageParam }),
    initialPageParam: "0",
    getNextPageParam: (last) => (last.cursor === "0" ? undefined : last.cursor),
    ...MANUAL,
  });
}

export function useRedisValue(serviceId: string, key: string | null) {
  return useQuery({
    queryKey: dataKeys.value(serviceId, key ?? ""),
    queryFn: () => api.get<RedisValue>("/database-data/key", { serviceId, key: key! }),
    enabled: !!key,
    ...MANUAL,
  });
}

export function useRedisCommand(serviceId: string) {
  const refresh = useRefreshData(serviceId);
  return useMutation({
    mutationFn: (body: Omit<RedisCommandInput, "serviceId">) => api.post<RedisCommandResult>("/database-data/command", { serviceId, ...body }),
    onSuccess: (r, body) => {
      if (body.allowWrites && !r.needsConfirm) void refresh();
    },
  });
}

export function useSetRedisString(serviceId: string) {
  const refresh = useRefreshData(serviceId);
  return useMutation({
    mutationFn: (body: Omit<SetRedisStringInput, "serviceId">) => api.put<RowsChanged>("/database-data/key", { serviceId, ...body }),
    onSuccess: () => void refresh(),
  });
}

export function useDeleteRedisKeys(serviceId: string) {
  const refresh = useRefreshData(serviceId);
  return useMutation({
    mutationFn: (body: Omit<DeleteRedisKeysInput, "serviceId">) => api.post<RowsChanged>("/database-data/keys/delete", { serviceId, ...body }),
    onSuccess: () => void refresh(),
  });
}
