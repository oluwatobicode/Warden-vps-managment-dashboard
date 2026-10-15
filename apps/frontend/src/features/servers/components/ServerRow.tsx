import { Link } from "react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import type { Server } from "shared-types";
import { StatusPill } from "../../../components/ui/StatusPill";
import { timeAgo } from "../../../utils/formatDate";
import { SERVER_DOT, serverWhere } from "./serverLabels";
import { UsageBars } from "./UsageBars";

export function ServerRow({ server: s }: { server: Server }) {
  const build = s.serverType === "BUILD";
  return (
    <Link to={`/settings/servers/${s.id}`} className="flex flex-wrap items-center justify-between gap-3.5 rounded-2xl border border-cb bg-card px-5 py-4 hover:border-fieldb">
      <span className="flex min-w-0 flex-[1_1_280px] items-center gap-[13px]">
        <span className={`size-[9px] shrink-0 rounded-full ${SERVER_DOT[s.status]}`} />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-[13.5px] text-strong">{s.serverName}</span>
          <span className="truncate text-[11px] text-sand">{serverWhere(s)} · {s.serverIp}:{s.serverPort}</span>
        </span>
        <span className={`ml-1.5 rounded-[7px] px-[9px] py-1 text-[10.5px] font-semibold whitespace-nowrap ${build ? "bg-brand-s text-brand" : "bg-chip text-muted-deep"}`}>
          {build ? "Build server" : "Deploy server"}
        </span>
      </span>
      <span className="flex min-w-[220px] flex-[1_1_220px] items-center">
        <UsageBars usage={s.usage} />
      </span>
      <span className="ml-auto flex items-center gap-3">
        <span className="flex flex-col items-end gap-1">
          <StatusPill status={s.status} />
          <span className="text-[10.5px] text-sand">
            {s.serviceCount} service{s.serviceCount === 1 ? "" : "s"} · {s.containers.running}/{s.containers.total} containers · {s.lastSeenAt ? `seen ${timeAgo(s.lastSeenAt)}` : "never tested"}
          </span>
        </span>
        <HugeiconsIcon icon={ArrowRight01Icon} size={15} strokeWidth={1.5} className="text-sand" />
      </span>
    </Link>
  );
}
