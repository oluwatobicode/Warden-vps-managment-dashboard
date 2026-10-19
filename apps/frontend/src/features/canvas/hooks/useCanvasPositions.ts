import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SaveCanvasPositionsInput, Service } from "shared-types";
import { api } from "../../../api/axiosinstance";
import { serviceKeys } from "../../services/hooks/useServices";

/**
 * PUT /canvas-positions. Optimistic: the services list in the cache moves
 * first, so the box stays where it was dropped; if the save fails the old
 * list comes back (the box springs back) and the caller shows a toast.
 */
export function useSaveCanvasPositions(environmentId: string) {
  const queryClient = useQueryClient();
  const key = serviceKeys.list(environmentId);
  return useMutation({
    mutationFn: (positions: SaveCanvasPositionsInput["positions"]) => api.put("/canvas-positions", { environmentId, positions }),
    onMutate: async (positions) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<Service[]>(key);
      const at = new Map(positions.map((p) => [p.serviceId, p]));
      queryClient.setQueryData<Service[]>(key, (list) =>
        list?.map((s) => {
          const p = at.get(s.id);
          return p ? { ...s, canvasX: p.x, canvasY: p.y } : s;
        }),
      );
      return { before };
    },
    onError: (_e, _p, ctx) => ctx?.before && queryClient.setQueryData(key, ctx.before),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
