import { useState } from "react";
import { FAILED_STEP_LABEL, PLATFORM_DEPLOY_FILTERS, type PlatformDeployFilter, type PlatformDeployRow } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Segmented } from "../../../components/ui/Segmented";
import { Skeleton } from "../../../components/ui/Skeleton";
import { StatusPill } from "../../../components/ui/StatusPill";
import { apiMessage } from "../../../utils/apiMessage";
import { formatDate, timeAgo } from "../../../utils/formatDate";
import { usePlatformDeploys } from "../hooks/usePlatform";
import { fmtSeconds } from "../format";

const FILTER_LABEL: Record<PlatformDeployFilter, string> = { all: "All", failed: "Failed", succeeded: "Succeeded" };

/**
 * Deploy rows: names, status and timings only (no commit, branch, logs or
 * error text: the api never sends them). No links: the platform pages never
 * open an org's own project pages.
 */
export function DeployTable({
  rows,
  pending,
  error,
  showTriggeredBy = true,
  empty = "No deploys yet.",
}: {
  rows: PlatformDeployRow[];
  pending?: boolean;
  error?: unknown;
  showTriggeredBy?: boolean;
  empty?: string;
}) {
  const heads = ["#", "Service", "Organization", ...(showTriggeredBy ? ["Started by"] : []), "Status", "Duration", "When", "Failed at"];
  const cols = heads.length;

  return (
    <div className="overflow-x-auto rounded-[18px] border border-cb bg-card">
      <table className="w-full min-w-[860px] text-left text-xs">
        <thead className="bg-head text-[10.5px] tracking-[.06em] text-sand uppercase">
          <tr>
            {heads.map((h) => (
              <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pending &&
            [0, 1, 2, 3].map((i) => (
              <tr key={i} className="border-t border-divider">
                <td colSpan={cols} className="px-4 py-3"><Skeleton className="h-4" /></td>
              </tr>
            ))}
          {rows.map((d) => (
            <tr key={d.id} className="border-t border-divider text-body">
              <td className="px-4 py-3 font-mono text-sand">#{d.number}</td>
              <td className="px-4 py-3 font-semibold text-strong">{d.serviceName}</td>
              <td className="px-4 py-3">{d.orgName}</td>
              {showTriggeredBy && (
                <td className="px-4 py-3">{d.triggeredByName ?? <span className="text-sand">unknown</span>}</td>
              )}
              <td className="px-4 py-3"><StatusPill status={d.status} /></td>
              <td className="px-4 py-3 font-mono whitespace-nowrap">{fmtSeconds(d.durationSeconds)}</td>
              <td className="px-4 py-3 whitespace-nowrap" title={formatDate(d.createdAt)}>{timeAgo(d.createdAt)}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                {d.failedStep ? <span className="text-crit">{FAILED_STEP_LABEL[d.failedStep]}</span> : <span className="text-sand">—</span>}
              </td>
            </tr>
          ))}
          {error != null && (
            <tr><td colSpan={cols} className="px-4 py-6 text-center text-crit">{apiMessage(error)}</td></tr>
          )}
          {!pending && error == null && !rows.length && (
            <tr><td colSpan={cols} className="px-4 py-6 text-center text-sand">{empty}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Every org's deploys, newest first, 50 a page, filtered by how they ended. */
export function DeploysList() {
  const [status, setStatus] = useState<PlatformDeployFilter>("all");
  const q = usePlatformDeploys(status);
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="m-0 text-[14.5px] font-bold text-strong">Every deploy</h3>
          <p className="m-0 text-[11.5px] text-sand">Across all orgs, newest first. Failed = failed or health check failed.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-sand">{rows.length ? `${rows.length}${q.hasNextPage ? "+" : ""} ${rows.length === 1 && !q.hasNextPage ? "deploy" : "deploys"}` : ""}</span>
          <div className="w-[330px] max-w-full">
            <Segmented options={PLATFORM_DEPLOY_FILTERS.map((s) => ({ id: s, label: FILTER_LABEL[s] }))} value={status} onChange={setStatus} />
          </div>
        </div>
      </div>

      <DeployTable
        rows={rows}
        pending={q.isPending}
        error={q.isError ? q.error : undefined}
        empty={status === "all" ? "No deploys yet." : `No ${FILTER_LABEL[status].toLowerCase()} deploys.`}
      />

      {q.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="secondary" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>Load more</Button>
        </div>
      )}
    </div>
  );
}
