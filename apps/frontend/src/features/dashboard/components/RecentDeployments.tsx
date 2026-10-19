import { Link } from "react-router";
import type { RecentDeployment } from "shared-types";
import { Skeleton } from "../../../components/ui/Skeleton";
import { StatusPill } from "../../../components/ui/StatusPill";
import { timeAgo } from "../../../utils/formatDate";

/** The org's last 10 deploys. Each row shows the deploy's own status, not a rollup. */
export function RecentDeployments({ rows, loading }: { rows: RecentDeployment[] | undefined; loading: boolean }) {
  return (
    <section className="overflow-hidden rounded-[18px] border border-cb bg-ink">
      <div className="flex items-center justify-between gap-3.5 border-b border-cb px-6 py-[18px]">
        <span className="text-[13px] font-semibold text-strong">Recent deployments</span>
        <span className="text-[11px] text-sand">Last 10</span>
      </div>
      {loading && <Skeleton className="m-5 h-24" />}
      {!loading && !rows?.length && (
        <div className="px-6 py-9 text-center">
          <p className="m-0 text-[13px] text-muted-deep">No deployments yet</p>
          <p className="m-0 mt-1.5 text-[11.5px] text-sand">Each deploy of a service shows up here with its status and who started it.</p>
        </div>
      )}
      {!!rows?.length && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="text-[10.5px] tracking-[.04em] text-sand uppercase">
                <th className="px-6 py-2.5 font-semibold">ID</th>
                <th className="px-3 py-2.5 font-semibold">Deployment</th>
                <th className="px-3 py-2.5 font-semibold">Project / environment</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-6 py-2.5 text-right font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-t border-divider hover:bg-field">
                  <td className="px-6 py-3 font-mono text-xs text-sand">#{d.number}</td>
                  <td className="max-w-[320px] px-3 py-3">
                    <Link to={`/projects/${d.projectId}/services/${d.serviceId}`} className="flex flex-col gap-0.5">
                      <span className="truncate font-mono text-[12.5px] text-strong">{d.serviceName}</span>
                      <span className="truncate text-[11px] text-sand">
                        {d.commitMessage ?? "No commit message"}
                        {d.commitSha && <span className="font-mono"> · {d.commitSha.slice(0, 7)}</span>}
                        {d.triggeredByName && <> · {d.triggeredByName}</>}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-[12px] text-body">
                    {d.projectName}
                    <span className="text-sand">/{d.environmentName}</span>
                    {d.branch && <span className="ml-1.5 font-mono text-[10.5px] text-faint">{d.branch}</span>}
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill status={d.status} />
                  </td>
                  <td className="px-6 py-3 text-right text-[11.5px] whitespace-nowrap text-sand" title={new Date(d.createdAt).toLocaleString("en-GB")}>
                    {timeAgo(d.finishedAt ?? d.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
