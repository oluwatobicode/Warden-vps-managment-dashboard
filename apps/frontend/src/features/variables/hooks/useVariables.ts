import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ResolvedVariable,
  RevealedVariable,
  UpdateVariableInput,
  Variable,
} from "shared-types";
import { api } from "../../../api/axiosinstance";

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
