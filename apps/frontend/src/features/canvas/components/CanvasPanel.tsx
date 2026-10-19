import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, Search01Icon, SidebarRight01Icon } from "@hugeicons/core-free-icons";
import type { Service } from "shared-types";
import { ButtonLink } from "../../../components/ui/Button";
import { FactRow } from "../../../components/ui/Card";
import { StatusPill } from "../../../components/ui/StatusPill";

const TYPE_LABEL: Record<Service["type"], string> = { APPLICATION: "Application", WORKER: "Worker", DATABASE: "Database", COMPOSE: "Compose" };

/**
 * The floating panel over the canvas. Two views: every service (searchable;
 * clicking one flies the canvas to it), or one service's details. Collapses
 * to a single button to give the canvas the full width.
 */
export function CanvasPanel({
  services,
  serverName,
  selected,
  onPick,
  onBack,
  servicePath,
  open,
  onOpenChange,
}: {
  services: Service[];
  serverName: (id: string | null) => string | undefined;
  selected: Service | undefined;
  onPick: (id: string) => void;
  onBack: () => void;
  servicePath: (id: string) => string;
  /** Owned by the canvas, which leaves room for the panel when it fits the view. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const setOpen = onOpenChange;
  const [q, setQ] = useState("");
  const shown = useMemo(() => services.filter((s) => s.serviceName.toLowerCase().includes(q.trim().toLowerCase())), [services, q]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Show services panel"
        className="absolute top-3 right-3 z-10 grid size-9 cursor-pointer place-items-center rounded-xl border border-cb bg-card text-muted-deep shadow-[0_8px_24px_rgba(0,0,0,.4)] hover:text-strong"
      >
        <HugeiconsIcon icon={SidebarRight01Icon} size={16} strokeWidth={1.5} />
      </button>
    );
  }

  return (
    <aside
      aria-label={selected ? `${selected.serviceName} details` : "Services"}
      className="absolute top-3 right-3 bottom-3 z-10 flex w-[280px] flex-col overflow-hidden rounded-2xl border border-cb bg-card/95 shadow-[0_16px_40px_rgba(0,0,0,.5)] backdrop-blur"
    >
      <div className="flex items-center gap-2 border-b border-divider px-3.5 py-3">
        {selected ? (
          <button type="button" onClick={onBack} className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-warm hover:text-strong">
            <HugeiconsIcon icon={ArrowLeft01Icon} size={13} strokeWidth={1.5} /> All services
          </button>
        ) : (
          <span className="text-xs font-semibold text-strong">
            Services <span className="font-normal text-sand">· {services.length}</span>
          </span>
        )}
        <button type="button" onClick={() => setOpen(false)} aria-label="Hide panel" className="ml-auto cursor-pointer text-sand hover:text-strong">
          <HugeiconsIcon icon={SidebarRight01Icon} size={15} strokeWidth={1.5} />
        </button>
      </div>

      {selected ? (
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3.5 py-3.5">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[15px] font-semibold text-strong">{selected.serviceName}</span>
            <StatusPill status={selected.status} />
          </div>
          <div>
            <FactRow label="Type">{TYPE_LABEL[selected.type]}</FactRow>
            <FactRow label="Server">{serverName(selected.serverId) ?? "not assigned"}</FactRow>
            <FactRow label="Source">{selected.image ?? selected.githubRepoUrl?.replace(/^https:\/\/github\.com\//, "") ?? "—"}</FactRow>
            {selected.branch && <FactRow label="Branch">{selected.branch}</FactRow>}
            <FactRow label="Port">{selected.port ?? "none"}</FactRow>
          </div>
          <div className="mt-auto flex flex-col gap-2 pt-2">
            <ButtonLink to={servicePath(selected.id)} className="text-xs">
              Open service
            </ButtonLink>
            <ButtonLink to={servicePath(selected.id)} variant="secondary" className="text-xs">
              Variables
            </ButtonLink>
          </div>
        </div>
      ) : (
        <>
          <label className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-cb bg-field px-2.5 py-2">
            <HugeiconsIcon icon={Search01Icon} size={13} strokeWidth={1.5} className="text-sand" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a service" aria-label="Find a service" className="min-w-0 flex-1 bg-transparent text-xs text-body outline-none placeholder:text-faint" />
          </label>
          <ul className="m-0 flex-1 list-none overflow-y-auto p-2">
            {shown.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => onPick(s.id)} className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-field">
                  <span className="min-w-0 truncate font-mono text-xs text-body">{s.serviceName}</span>
                  <StatusPill status={s.status} />
                </button>
              </li>
            ))}
            {!shown.length && <li className="px-2.5 py-3 text-xs text-sand">{services.length ? "No service matches." : "No services yet."}</li>}
          </ul>
        </>
      )}
    </aside>
  );
}
