import { Link } from "react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, Folder01Icon, Layers01Icon, ServerStack01Icon } from "@hugeicons/core-free-icons";
import { PageHeader } from "../components/layout/PageHeader";
import { Skeleton } from "../components/ui/Skeleton";
import { StatusPill } from "../components/ui/StatusPill";
import { useAuth } from "../features/auth/hooks/useAuth";
import { useProjects } from "../features/projects/hooks/useProjects";
import { useServers } from "../features/servers/hooks/useServers";
import { SERVER_DOT } from "../features/servers/components/serverLabels";

/** Console Home: counts across the org, plus where to look first. */
export default function HomePage() {
  const { user } = useAuth();
  const projects = useProjects();
  const servers = useServers();

  const p = projects.data ?? [];
  const s = servers.data ?? [];
  const services = p.reduce((n, x) => n + x.serviceCount, 0);
  const environments = p.reduce((n, x) => n + x.environmentCount, 0);
  const attention = p.filter((x) => x.status === "DEGRADED" || x.status === "FAILED");
  const connected = s.filter((x) => x.status === "CONNECTED").length;
  const offline = s.filter((x) => x.status === "OFFLINE").length;

  const kpis = [
    { label: "Projects", value: p.length, sub: `${environments} environment${environments === 1 ? "" : "s"}`, dot: "bg-brand", icon: Folder01Icon },
    { label: "Services", value: services, sub: `across ${p.length} project${p.length === 1 ? "" : "s"}`, dot: "bg-good", icon: Layers01Icon },
    { label: "Need attention", value: attention.length, sub: attention.length ? "degraded or failed" : "nothing failing", dot: attention.length ? "bg-crit" : "bg-good", icon: Alert02Icon },
    { label: "Servers connected", value: `${connected} / ${s.length}`, sub: offline ? `${offline} offline` : "none offline", dot: offline ? "bg-crit" : "bg-good", icon: ServerStack01Icon },
  ];
  const loading = projects.isPending || servers.isPending;

  return (
    <>
      <PageHeader title="Home" aside={<span className="text-sm text-muted-warm">{user?.organization.name} · all projects</span>} />

      <div className="mt-[34px] grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="flex flex-col gap-3.5 rounded-[18px] border border-cb bg-ink px-6 py-[22px]">
            <span className="flex items-center justify-between gap-2.5">
              <span className="text-[11px] font-semibold tracking-[.08em] text-sand uppercase">{k.label}</span>
              <HugeiconsIcon icon={k.icon} size={15} strokeWidth={1.5} className="text-faint" />
            </span>
            {loading ? <Skeleton className="h-10 w-16" /> : <span className="font-display text-[40px] leading-none font-extrabold text-strong">{k.value}</span>}
            <span className="flex items-center gap-2">
              <span className={`size-1.5 rounded-full ${k.dot}`} />
              <span className="text-[11.5px] text-muted-deep">{k.sub}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4">
        <section className="overflow-hidden rounded-[18px] border border-cb bg-ink">
          <div className="flex items-center justify-between gap-3.5 border-b border-cb px-6 py-[18px]">
            <span className="text-[13px] font-semibold text-strong">Projects</span>
            <Link to="/projects" className="text-xs font-semibold text-good">View all →</Link>
          </div>
          {loading && <Skeleton className="m-5 h-24" />}
          {!loading && p.length === 0 && <p className="px-6 py-8 text-[12.5px] text-muted-warm">No projects yet.</p>}
          {[...attention, ...p.filter((x) => !attention.includes(x))].slice(0, 6).map((x) => (
            <Link key={x.id} to={`/projects/${x.id}`} className="grid grid-cols-[minmax(0,1fr)_150px_auto] items-center gap-4 border-b border-divider px-6 py-3.5 last:border-b-0 hover:bg-field">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[13px] text-strong">{x.projectName}</span>
                <span className="truncate font-mono text-[10.5px] text-sand">/{x.slug}</span>
              </span>
              <span className="text-[11.5px] text-sand">
                {x.environmentCount} env · {x.serviceCount} service{x.serviceCount === 1 ? "" : "s"}
              </span>
              <StatusPill status={x.status} />
            </Link>
          ))}
        </section>

        <section className="overflow-hidden rounded-[18px] border border-cb bg-ink">
          <div className="flex items-center justify-between gap-3.5 border-b border-cb px-6 py-[18px]">
            <span className="text-[13px] font-semibold text-strong">Servers</span>
            <Link to="/settings/servers" className="text-xs font-semibold text-good">Manage →</Link>
          </div>
          {loading && <Skeleton className="m-5 h-24" />}
          {!loading && s.length === 0 && <p className="px-6 py-8 text-[12.5px] text-muted-warm">No servers yet.</p>}
          {s.slice(0, 6).map((x) => (
            <Link key={x.id} to={`/settings/servers/${x.id}`} className="flex items-center gap-[11px] border-b border-divider px-6 py-3 last:border-b-0 hover:bg-field">
              <span className={`size-2 shrink-0 rounded-full ${SERVER_DOT[x.status]}`} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-mono text-xs text-body">{x.serverName}</span>
                <span className="text-[10px] text-sand">{x.serverType === "BUILD" ? "Build" : "Deploy"} server · {x.serviceCount} service{x.serviceCount === 1 ? "" : "s"}</span>
              </span>
              <StatusPill status={x.status} />
            </Link>
          ))}
        </section>
      </div>
    </>
  );
}
