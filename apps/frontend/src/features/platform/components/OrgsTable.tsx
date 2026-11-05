import { useState } from "react";
import { PLATFORM_ORG_SORTS, type PlatformOrgSort } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Segmented } from "../../../components/ui/Segmented";
import { Skeleton } from "../../../components/ui/Skeleton";
import { apiMessage } from "../../../utils/apiMessage";
import { formatDate, timeAgo } from "../../../utils/formatDate";
import { usePlatformOrgs } from "../hooks/usePlatform";
import { fmtInt } from "../format";

const SORT_LABEL: Record<PlatformOrgSort, string> = { created: "Newest", lastActive: "Last active", deploys30d: "Most deploys" };

/** Every org: names and numbers only (no emails, IPs or repos). 50 a page. */
export function OrgsTable() {
  const [sort, setSort] = useState<PlatformOrgSort>("created");
  const q = usePlatformOrgs(sort);
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="w-[440px] max-w-full">
          <Segmented options={PLATFORM_ORG_SORTS.map((s) => ({ id: s, label: SORT_LABEL[s] }))} value={sort} onChange={setSort} />
        </div>
        <span className="text-xs text-sand">{rows.length ? `${rows.length}${q.hasNextPage ? "+" : ""} orgs` : ""}</span>
      </div>

      <div className="overflow-x-auto rounded-[18px] border border-cb bg-card">
        <table className="w-full min-w-[1000px] text-left text-xs">
          <thead className="bg-head text-[10.5px] tracking-[.06em] text-sand uppercase">
            <tr>
              {["Organization", "Created", "Members", "Last active", "Servers", "Projects", "Services", "Deploys 30d", "Last deploy", "Deployed ok", "Backups"].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {q.isPending &&
              [0, 1, 2, 3].map((i) => (
                <tr key={i} className="border-t border-divider">
                  <td colSpan={11} className="px-4 py-3"><Skeleton className="h-4" /></td>
                </tr>
              ))}
            {rows.map((o) => (
              <tr key={o.id} className="border-t border-divider text-body">
                <td className="px-4 py-3">
                  <div className="font-semibold text-strong">{o.name}</div>
                  <div className="font-mono text-[10.5px] text-sand">{o.slug}</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(o.createdAt)}</td>
                <td className="px-4 py-3 font-mono">{o.members}</td>
                <td className="px-4 py-3 whitespace-nowrap">{o.lastActiveAt ? timeAgo(o.lastActiveAt) : <span className="text-sand">never</span>}</td>
                <td className="px-4 py-3 font-mono whitespace-nowrap">
                  {o.servers}
                  {o.serversOffline > 0 && <span className="ml-1.5 text-crit">({o.serversOffline} offline)</span>}
                </td>
                <td className="px-4 py-3 font-mono">{o.projects}</td>
                <td className="px-4 py-3 font-mono">{o.services}</td>
                <td className="px-4 py-3 font-mono">{fmtInt(o.deploys30d)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{o.lastDeployAt ? timeAgo(o.lastDeployAt) : <span className="text-sand">never</span>}</td>
                <td className="px-4 py-3">{o.everDeployedOk ? <span className="text-good">yes</span> : <span className="text-sand">no</span>}</td>
                <td className="px-4 py-3 text-muted-deep">{o.backupStorage === "own" ? "own bucket" : "platform"}</td>
              </tr>
            ))}
            {q.isError && (
              <tr><td colSpan={11} className="px-4 py-6 text-center text-crit">{apiMessage(q.error)}</td></tr>
            )}
            {q.isSuccess && !rows.length && (
              <tr><td colSpan={11} className="px-4 py-6 text-center text-sand">No organizations yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {q.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="secondary" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>Load more</Button>
        </div>
      )}
    </div>
  );
}
