import type { ServerContainer } from "shared-types";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Skeleton } from "../../../components/ui/Skeleton";
import { apiMessage } from "../../../utils/apiMessage";
import { formatBytes } from "../../../utils/formatBytes";
import { timeAgo } from "../../../utils/formatDate";
import { useServerContainers } from "../hooks/useMonitoring";

/** Docker's state, plus the healthcheck when there is one. Colour always comes with a word. */
function StateBadge({ c }: { c: ServerContainer }) {
  const state =
    c.state === "running"
      ? c.health === "unhealthy"
        ? { label: "unhealthy", cls: "bg-crit-s text-crit" }
        : c.health === "starting"
          ? { label: "starting", cls: "bg-brand-s text-brand" }
          : { label: c.health === "healthy" ? "healthy" : "running", cls: "bg-good-s text-good" }
      : c.state === "restarting"
        ? { label: "restarting", cls: "bg-serious-s text-serious" }
        : c.state === "exited" || c.state === "dead"
          ? { label: c.state, cls: "bg-chip text-sand" }
          : { label: c.state, cls: "bg-chip text-muted-deep" };
  return <span className={`rounded-md px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap ${state.cls}`}>{state.label}</span>;
}

/** Every container on the server right now, refreshed every minute. */
export function ContainersTab({ serverId }: { serverId: string }) {
  const list = useServerContainers(serverId);

  if (list.isPending) return <Skeleton className="mt-5 h-48 rounded-[18px]" />;
  if (list.isError) return <p className="mt-5 text-sm text-crit">{apiMessage(list.error)}</p>;
  const { items, collectedAt } = list.data;
  if (!items.length) {
    return (
      <div className="mt-5">
        <EmptyState title="No containers">
          Nothing is running on this server yet, or Warden can't use Docker there. Test connection shows whether Docker is reachable for this SSH user.
        </EmptyState>
      </div>
    );
  }
  const running = items.filter((c) => c.state === "running").length;

  return (
    <div className="mt-5 pb-2">
      <p className="m-0 mb-3 text-[11.5px] text-sand">
        {running} of {items.length} running · updated {collectedAt ? timeAgo(collectedAt) : "never"}
      </p>
      <div className="overflow-x-auto rounded-[18px] border border-cb">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="bg-head text-[10.5px] tracking-[.04em] text-sand uppercase">
              <th className="px-4 py-2.5 font-semibold">Container</th>
              <th className="px-4 py-2.5 font-semibold">State</th>
              <th className="px-4 py-2.5 text-right font-semibold">CPU</th>
              <th className="px-4 py-2.5 text-right font-semibold">Memory</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t border-divider bg-card">
                <td className="px-4 py-3">
                  <span className="flex flex-col gap-0.5">
                    <span className="font-mono text-[12.5px] text-strong">{c.name}</span>
                    <span className="truncate font-mono text-[10.5px] text-sand" title={c.image}>
                      {c.image} · {c.dockerId}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3"><StateBadge c={c} /></td>
                <td className="px-4 py-3 text-right font-mono text-xs text-body">{c.cpu == null ? "—" : `${c.cpu}%`}</td>
                <td className="px-4 py-3 text-right font-mono text-xs text-body">
                  {c.memoryBytes == null ? "—" : formatBytes(c.memoryBytes)}
                  {c.memoryLimitBytes != null && <span className="text-sand"> / {formatBytes(c.memoryLimitBytes)}</span>}
                </td>
                <td className="px-4 py-3 text-[11.5px] text-muted-warm">{c.statusText}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
