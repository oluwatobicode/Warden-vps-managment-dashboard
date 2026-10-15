import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ResolvedVariable,
  RevealedVariable,
  UpdateVariableInput,
  Variable,
} from "shared-types";
import { api } from "../../../api/axiosinstance";
import { apiMessage } from "../../../utils/apiMessage";

export type VariableOwner =
  | { kind: "environment"; id: string }
  | { kind: "service"; id: string };

const base = (o: VariableOwner) =>
  o.kind === "environment" ? "/environment-variables" : "/service-variables";
const ownerParam = (o: VariableOwner): Record<string, string> =>
  o.kind === "environment" ? { environmentId: o.id } : { serviceId: o.id };

export const variableKeys = {
  list: (o: VariableOwner) => ["variables", o.kind, o.id] as const,
  resolved: (serviceId: string) =>
    ["variables", "resolved", serviceId] as const,
};

export function useVariables(owner: VariableOwner | undefined) {
  return useQuery({
    queryKey: owner ? variableKeys.list(owner) : ["variables", "none"],
    queryFn: () => api.get<Variable[]>(base(owner!), ownerParam(owner!)),
    enabled: !!owner,
  });
}

export function useResolvedVariables(serviceId: string, enabled: boolean) {
  return useQuery({
    queryKey: variableKeys.resolved(serviceId),
    queryFn: () =>
      api.get<ResolvedVariable[]>("/service-variables/resolved", { serviceId }),
    enabled,
  });
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["variables"] });
}

export function useCreateVariable(owner: VariableOwner) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: { key: string; value: string; isSecret: boolean }) =>
      api.post<Variable>(base(owner), { ...input, ...ownerParam(owner) }),
    onSuccess: refresh,
  });
}

export function useUpdateVariable(owner: VariableOwner) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateVariableInput }) =>
      api.patch<Variable>(`${base(owner)}/${id}`, input),
    onSuccess: refresh,
  });
}

export function useDeleteVariable(owner: VariableOwner) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (id: string) => api.delete(`${base(owner)}/${id}`),
    onSuccess: refresh,
  });
}

export function useRevealVariable(owner: VariableOwner) {
  return useMutation({
    mutationFn: (id: string) =>
      api.get<RevealedVariable>(`${base(owner)}/${id}/reveal`),
  });
}

export interface ImportRow {
  key: string;
  value: string;
  /** The existing variable with this key, if there is one. */
  existingId?: string;
}

export interface ImportResult {
  key: string;
  outcome: "added" | "updated" | "skipped" | "failed";
  error?: string;
}

/**
 * Saves pasted/uploaded .env lines one after another (the API has no bulk
 * route). NOT all-or-nothing: each line's outcome is reported, so a failure
 * halfway leaves the earlier ones saved and says which didn't go in.
 */
export function useImportVariables(owner: VariableOwner) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ rows, isSecret, overwrite }: { rows: ImportRow[]; isSecret: boolean; overwrite: boolean }) => {
      const results: ImportResult[] = [];
      for (const r of rows) {
        try {
          if (r.existingId) {
            if (!overwrite) {
              results.push({ key: r.key, outcome: "skipped" });
              continue;
            }
            await api.patch(`${base(owner)}/${r.existingId}`, { value: r.value, isSecret });
            results.push({ key: r.key, outcome: "updated" });
          } else {
            await api.post(base(owner), { key: r.key, value: r.value, isSecret, ...ownerParam(owner) });
            results.push({ key: r.key, outcome: "added" });
          }
        } catch (e) {
          results.push({ key: r.key, outcome: "failed", error: apiMessage(e) });
        }
      }
      return results;
    },
    // One refresh at the end, not one per line.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["variables"] }),
  });
}
