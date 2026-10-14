import type { ResolvedVariable } from "shared-types";
import { Chip } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Skeleton } from "../../../components/ui/Skeleton";
import { apiMessage } from "../../../utils/apiMessage";
import { useResolvedVariables } from "../hooks/useVariables";

export function ResolvedVariables({ serviceId }: { serviceId: string }) {
  const resolved = useResolvedVariables(serviceId, true);
  if (resolved.isPending) return <Skeleton className="mt-3.5 h-32" />;
  if (resolved.isError)
    return (
      <p className="mt-4 text-sm text-crit">{apiMessage(resolved.error)}</p>
    );
  if (!resolved.data.length)
    return (
      <div className="mt-3.5">
        <EmptyState title="Nothing to inject yet">
          Neither this service nor its environment has variables.
        </EmptyState>
      </div>
    );
  return (
    <div className="mt-3.5 overflow-x-auto rounded-2xl border border-cb">
      {resolved.data.map((v: ResolvedVariable) => (
        <div
          key={v.key}
          className="grid min-w-[560px] grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_120px] items-center gap-3.5 border-b border-divider bg-card px-[18px] py-[11px] last:border-b-0"
        >
          <span className="truncate font-mono text-xs text-body">{v.key}</span>
          <span
            className={`truncate font-mono text-xs ${v.value === null ? "text-[#6b6960]" : "text-body"}`}
          >
            {v.value ?? "••••••••••••••••••••"}
          </span>
          <span className="justify-self-start">
            <Chip>
              {v.source === "service" ? "this service" : "environment"}
            </Chip>
          </span>
        </div>
      ))}
    </div>
  );
}
