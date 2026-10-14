import { Link } from "react-router";
import type { Service } from "shared-types";
import { StatusPill } from "../../../components/ui/StatusPill";
import { timeAgo } from "../../../utils/formatDate";
import { TYPE_LABEL, sourceLabel } from "./serviceLabels";

export function ServiceCard({ service: s, to, serverName }: { service: Service; to: string; serverName?: string }) {
  const meta = [serverName ?? "no server", s.port ? `:${s.port}` : null].filter(Boolean).join(" · ");
  return (
    <Link to={to} className="flex flex-col gap-[13px] rounded-2xl border border-cb bg-card px-[18px] py-4 text-left hover:border-fieldb">
      <span className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-[5px]">
          <span className="truncate font-mono text-[13px] text-strong">{s.serviceName}</span>
          <span className="truncate text-[11px] text-sand">{TYPE_LABEL[s.type]} · {sourceLabel(s)}</span>
        </span>
        <StatusPill status={s.status} />
      </span>
      <span className="flex items-center justify-between gap-2.5 border-t border-divider pt-[11px]">
        <span className="min-w-0 truncate font-mono text-[11px] text-muted-deep">{meta}</span>
        <span className="shrink-0 text-[11px] whitespace-nowrap text-sand">updated {timeAgo(s.updatedAt)}</span>
      </span>
    </Link>
  );
}
