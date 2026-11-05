import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { PLATFORM_USER_SORTS, type PlatformUserSort } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Segmented } from "../../../components/ui/Segmented";
import { Skeleton } from "../../../components/ui/Skeleton";
import { apiMessage } from "../../../utils/apiMessage";
import { formatDate, timeAgo } from "../../../utils/formatDate";
import { usePlatformUsers } from "../hooks/usePlatform";
import { AUTH_LABEL, fmtInt } from "../format";

const SORT_LABEL: Record<PlatformUserSort, string> = { joined: "Newest", lastActive: "Last active", deploys: "Most deploys", failed: "Most failed" };
const HEADS = ["Name", "Organization", "Signed up with", "Joined", "Last active", "Deploys", "Failed"];

/** Every user: names and numbers, never an email (that's the logged reveal on their page). 50 a page. */
export function UsersTable() {
  const navigate = useNavigate();
  const [sort, setSort] = useState<PlatformUserSort>("joined");
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  // Search after typing stops, not on every key.
  useEffect(() => {
    const t = setTimeout(() => setSearch(typed), 300);
    return () => clearTimeout(t);
  }, [typed]);
  const q = usePlatformUsers(sort, search);
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-[580px] max-w-full">
          <Segmented options={PLATFORM_USER_SORTS.map((s) => ({ id: s, label: SORT_LABEL[s] }))} value={sort} onChange={setSort} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-sand">{rows.length ? `${rows.length}${q.hasNextPage ? "+" : ""} ${rows.length === 1 && !q.hasNextPage ? "user" : "users"}` : ""}</span>
          <label className="flex w-[200px] items-center gap-2 rounded-[10px] border border-cb bg-field px-3 py-2.5 focus-within:border-focus">
            <HugeiconsIcon icon={Search01Icon} size={14} strokeWidth={1.5} className="shrink-0 text-sand" />
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Search by name"
              aria-label="Search users by name"
              maxLength={100}
              className="min-w-0 flex-1 bg-transparent text-xs text-body outline-none placeholder:text-faint"
            />
          </label>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[18px] border border-cb bg-card">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="bg-head text-[10.5px] tracking-[.06em] text-sand uppercase">
            <tr>
              {HEADS.map((h) => (
                <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {q.isPending &&
              [0, 1, 2, 3].map((i) => (
                <tr key={i} className="border-t border-divider">
                  <td colSpan={HEADS.length} className="px-4 py-3"><Skeleton className="h-4" /></td>
                </tr>
              ))}
            {rows.map((u) => (
              <tr
                key={u.id}
                onClick={() => navigate(`/platform/users/${u.id}`)}
                className="cursor-pointer border-t border-divider text-body hover:bg-raised"
              >
                <td className="px-4 py-3 font-semibold text-strong">
                  {/* The link makes the row reachable by keyboard; the row's click is the mouse shortcut. */}
                  <Link to={`/platform/users/${u.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                    {u.name || <span className="text-sand">no name</span>}
                  </Link>
                </td>
                <td className="px-4 py-3">{u.org?.name ?? <span className="text-sand">none</span>}</td>
                <td className="px-4 py-3">{AUTH_LABEL[u.authProcess]}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{u.lastActiveAt ? timeAgo(u.lastActiveAt) : <span className="text-sand">never</span>}</td>
                <td className="px-4 py-3 font-mono">{fmtInt(u.deploys)}</td>
                <td className="px-4 py-3 font-mono">{u.failedDeploys ? <span className="text-crit">{fmtInt(u.failedDeploys)}</span> : 0}</td>
              </tr>
            ))}
            {q.isError && (
              <tr><td colSpan={HEADS.length} className="px-4 py-6 text-center text-crit">{apiMessage(q.error)}</td></tr>
            )}
            {q.isSuccess && !rows.length && (
              <tr><td colSpan={HEADS.length} className="px-4 py-6 text-center text-sand">{search.trim().length >= 2 ? "No user with that name." : "No users yet."}</td></tr>
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
