import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Folder01Icon,
  Key01Icon,
  Notification01Icon,
  ServerStack01Icon,
  SquareLock02Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import type { AuditLog } from "shared-types";
import { Button } from "../../components/ui/Button";
import { SectionHeader } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuditLogPage } from "../../features/audit-logs/hooks/useAuditLogs";
import { auditActor, describeAudit, type AuditArea } from "../../features/audit-logs/components/describeAudit";
import { AuditEntryDrawer } from "../../features/audit-logs/components/AuditEntryDrawer";
import { apiMessage } from "../../utils/apiMessage";
import { timeAgo } from "../../utils/formatDate";

const AREA: Record<AuditArea, { icon: typeof Key01Icon; tone: string }> = {
  secrets: { icon: SquareLock02Icon, tone: "text-[#eab308]" },
  team: { icon: UserGroupIcon, tone: "text-brand" },
  access: { icon: Key01Icon, tone: "text-serious" },
  infra: { icon: ServerStack01Icon, tone: "text-good" },
  projects: { icon: Folder01Icon, tone: "text-muted-deep" },
  notifications: { icon: Notification01Icon, tone: "text-muted-deep" },
};
const SIZES = [20, 50, 100] as const;

/** ADMIN only (the route is guarded; the API refuses everyone else too). */
export default function AuditLogPage() {
  // The API pages by cursor, so "page N" = the cursor that page N started at.
  // cursors[0] is null (the newest page); Older pushes, Newer pops.
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const [limit, setLimit] = useState<number>(20);
  const [open, setOpen] = useState<AuditLog | null>(null);
  const page = cursors.length;
  const log = useAuditLogPage(cursors[page - 1], limit);
  const items = log.data?.items ?? [];
  const first = (page - 1) * limit + 1;

  const older = () => log.data?.nextCursor && setCursors((c) => [...c, log.data!.nextCursor]);
  const newer = () => setCursors((c) => (c.length > 1 ? c.slice(0, -1) : c));
  const resize = (n: number) => {
    setLimit(n);
    setCursors([null]); // a different page size means different page boundaries
  };

  return (
    <>
      <SectionHeader
        title="Audit log"
        sub="Who did what in this organization, newest first. Click an entry for its details. Secret values are never recorded, only which secret was revealed."
      />
      <div className="mt-[22px] pb-2">
        {log.isPending && <Skeleton className="h-60 rounded-2xl" />}
        {log.isError && <p className="text-sm text-crit">{apiMessage(log.error)}</p>}
        {log.data && items.length === 0 && page === 1 && (
          <EmptyState title="Nothing recorded yet">Team changes, tokens, servers, keys and secret reveals show up here.</EmptyState>
        )}

        {items.length > 0 && (
          <ol className={`overflow-hidden rounded-2xl border border-cb transition-opacity ${log.isPlaceholderData ? "opacity-60" : ""}`}>
            {items.map((e) => {
              const { text, area } = describeAudit(e);
              const a = AREA[area];
              return (
                <li key={e.id} className="border-b border-divider last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setOpen(e)}
                    aria-haspopup="dialog"
                    className={`flex w-full cursor-pointer items-start gap-3 px-[18px] py-3.5 text-left ${open?.id === e.id ? "bg-raised" : "bg-card hover:bg-field"}`}
                  >
                    <span className={`mt-px grid size-7 shrink-0 place-items-center rounded-lg bg-chip ${a.tone}`}>
                      <HugeiconsIcon icon={a.icon} size={14} strokeWidth={1.5} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <span className="text-[12.5px] text-body">{text}</span>
                      <span className="truncate text-[10.5px] text-sand">{auditActor(e)}</span>
                    </span>
                    <time dateTime={e.createdAt} title={new Date(e.createdAt).toLocaleString("en-GB")} className="shrink-0 text-[11px] whitespace-nowrap text-sand">
                      {timeAgo(e.createdAt)}
                    </time>
                    <HugeiconsIcon icon={ArrowRight01Icon} size={13} strokeWidth={1.5} className="mt-0.5 shrink-0 text-faint" />
                  </button>
                </li>
              );
            })}
          </ol>
        )}

        {log.data && (items.length > 0 || page > 1) && (
          <nav aria-label="Audit log pages" className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11.5px] text-sand">
              {log.isPlaceholderData ? "Loading…" : items.length ? `Showing ${first}–${first + items.length - 1}` : "No entries on this page"} · Page {page}
            </span>
            <span className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-[11.5px] text-sand">
                Rows
                <select
                  value={limit}
                  onChange={(e) => resize(Number(e.target.value))}
                  className="cursor-pointer rounded-lg border border-cb bg-field px-2 py-1.5 text-[11.5px] text-body outline-none"
                >
                  {SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <Button variant="secondary" onClick={newer} disabled={page === 1 || log.isFetching} className="px-3 py-2 text-xs">
                <HugeiconsIcon icon={ArrowLeft01Icon} size={13} strokeWidth={1.5} />
                Newer
              </Button>
              <Button variant="secondary" onClick={older} disabled={!log.data.nextCursor || log.isFetching} className="px-3 py-2 text-xs">
                Older
                <HugeiconsIcon icon={ArrowRight01Icon} size={13} strokeWidth={1.5} />
              </Button>
            </span>
          </nav>
        )}
      </div>
      <AuditEntryDrawer entry={open} onClose={() => setOpen(null)} />
    </>
  );
}
