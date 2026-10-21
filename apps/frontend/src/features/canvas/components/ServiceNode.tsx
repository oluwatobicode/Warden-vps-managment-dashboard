import { memo } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Database01Icon, Layers01Icon, Rocket01Icon } from "@hugeicons/core-free-icons";
import type { Service } from "shared-types";
import { StatusPill } from "../../../components/ui/StatusPill";
import { NODE_H, NODE_W } from "../layout";
import { DatabaseLogo } from "../../databases/components/DatabaseLogo";
import { engineOf } from "../../databases/engine";

export type ServiceNodeData = { service: Service; serverName?: string };
export type ServiceNodeType = Node<ServiceNodeData, "service">;

const ICON = { APPLICATION: Rocket01Icon, WORKER: Layers01Icon, DATABASE: Database01Icon, COMPOSE: Layers01Icon } as const;

/** One service's box on the canvas. */
export const ServiceNode = memo(function ServiceNode({ data, selected }: NodeProps<ServiceNodeType>) {
  const s = data.service;
  const engine = engineOf(s);
  const meta = [data.serverName ?? "no server", s.port ? `:${s.port}` : null].filter(Boolean).join(" · ");
  return (
    <div
      style={{ width: NODE_W, height: NODE_H }}
      className={`flex cursor-grab flex-col justify-between rounded-2xl border bg-card px-4 py-3.5 shadow-[0_8px_24px_rgba(0,0,0,.35)] active:cursor-grabbing ${selected ? "border-brand" : "border-cb hover:border-fieldb"}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-chip text-muted-deep">
          {engine ? <DatabaseLogo engine={engine} size={15} /> : <HugeiconsIcon icon={ICON[s.type]} size={14} strokeWidth={1.5} />}
        </span>
        <span className="min-w-0 truncate font-mono text-[13px] font-semibold text-strong">{s.serviceName}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <StatusPill status={s.status} />
        <span className="truncate font-mono text-[10.5px] text-sand">{meta}</span>
      </div>
    </div>
  );
});
