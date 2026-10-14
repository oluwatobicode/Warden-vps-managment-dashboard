import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Layers01Icon, PlusSignCircleIcon, Rocket01Icon } from "@hugeicons/core-free-icons";
import type { Service } from "shared-types";
import { Breadcrumbs } from "../../components/layout/Breadcrumbs";
import { Button, ButtonLink } from "../../components/ui/Button";
import { Chip, SectionHeader } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatusPill } from "../../components/ui/StatusPill";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { useProjectContext } from "../../features/projects/hooks/useProjectContext";
import { useServices } from "../../features/services/hooks/useServices";
import { useServers } from "../../features/servers/hooks/useServers";
import { ServiceCard } from "../../features/services/components/ServiceCard";
import { AddServiceModal } from "../../features/services/components/AddServiceModal";
import { EnvironmentModal } from "../../features/environments/components/EnvironmentModal";
import { apiMessage } from "../../utils/apiMessage";
import { atLeast } from "../../utils/roles";

const GROUPS = [
  { type: "APPLICATION", label: "Applications", hint: "serve traffic on a port", icon: Rocket01Icon },
  { type: "WORKER", label: "Workers", hint: "background jobs, no port", icon: Layers01Icon },
] as const;

export default function ProjectOverviewPage() {
  const { project, environments, env, selectEnv, withEnv } = useProjectContext();
  const { user } = useAuth();
  const services = useServices(env?.id);
  const servers = useServers();
  const [adding, setAdding] = useState(false);
  const [newEnv, setNewEnv] = useState(false);

  const serverName = useMemo(() => new Map((servers.data ?? []).map((s) => [s.id, s.serverName])), [servers.data]);
  const canAddService = atLeast(user?.role, "DEVELOPER");
  const canAddEnv = atLeast(user?.role, "DEV_OPS");
  const servicePath = (id: string) => withEnv(`/projects/${project.id}/services/${id}`);

  return (
    <>
      <Breadcrumbs items={[{ label: "Projects", to: "/projects" }, { label: project.projectName }]} />
      <SectionHeader
        title={project.projectName}
        sub={
          <span className="flex flex-wrap items-center gap-2.5">
            {project.projectDescription && <Chip>{project.projectDescription}</Chip>}
            <span>
              {environments.length} environment{environments.length === 1 ? "" : "s"}, {project.serviceCount} service{project.serviceCount === 1 ? "" : "s"}
            </span>
          </span>
        }
        action={
          <>
            <ButtonLink variant="secondary" to={withEnv(`/projects/${project.id}/settings`)}>
              Project settings
            </ButtonLink>
            {canAddService && env && (
              <Button onClick={() => setAdding(true)}>
                <HugeiconsIcon icon={PlusSignCircleIcon} size={14} strokeWidth={1.5} />
                Add service
              </Button>
            )}
          </>
        }
      />

      <div className="mt-[22px] grid grid-cols-[210px_minmax(0,1fr)] gap-[18px] pb-2">
        <div className="flex flex-col gap-2">
          <p className="m-0 mb-0.5 text-[10px] tracking-[.07em] text-sand uppercase">Environments</p>
          {environments.map((e) => {
            const on = e.id === env?.id;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => selectEnv(e.id)}
                aria-pressed={on}
                className={`flex cursor-pointer flex-col gap-2 rounded-[14px] border px-[15px] py-3.5 text-left ${on ? "border-brand-border bg-brand-s" : "border-cb bg-card hover:border-fieldb"}`}
              >
                <span className={`font-mono text-[13px] font-semibold ${on ? "text-white" : "text-body"}`}>{e.environmentName}</span>
                <span className="text-[10.5px] text-sand">
                  {e.serviceCount} service{e.serviceCount === 1 ? "" : "s"}
                  {e.branch ? ` · ${e.branch}` : ""}
                </span>
              </button>
            );
          })}
          {canAddEnv && (
            <button
              type="button"
              onClick={() => setNewEnv(true)}
              className="flex cursor-pointer items-center gap-[9px] rounded-[14px] border border-dashed border-fieldb px-[15px] py-[13px] text-left text-xs text-muted-warm hover:border-brand-border hover:text-link"
            >
              <HugeiconsIcon icon={PlusSignCircleIcon} size={13} strokeWidth={1.5} />
              New environment
            </button>
          )}
          {env && (
            <div className="mt-2 flex flex-col gap-[11px] rounded-[14px] bg-ink p-[15px]">
              <span className="text-[10.5px] tracking-[.06em] text-muted uppercase">This environment</span>
              <StatusPill status={env.status} />
              <span className="flex flex-col gap-1.5 border-t border-navb pt-[11px] text-[11px]">
                <span className="text-muted-warm">{env.serviceCount} service{env.serviceCount === 1 ? "" : "s"}</span>
                <span className="text-muted-warm">Default branch: <span className="font-mono">{env.branch ?? "not set"}</span></span>
              </span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-3.5">
          {!env && <EmptyState title="No environments">Create an environment first; services live inside one.</EmptyState>}
          {env && services.isPending && <Skeleton className="h-40" />}
          {services.isError && <p className="text-sm text-crit">{apiMessage(services.error)}</p>}
          {env && services.data?.length === 0 && (
            <EmptyState
              title={`No services in ${env.environmentName}`}
              action={canAddService && <Button onClick={() => setAdding(true)}>Add service</Button>}
            >
              A service is one deployable thing from one repo or image: an API, a website, a queue worker.
            </EmptyState>
          )}
          {!!services.data?.length &&
            GROUPS.map((g) => {
              const items = services.data.filter((s: Service) => s.type === g.type);
              if (!items.length) return null;
              return (
                <section key={g.type}>
                  <div className="mb-2.5 flex items-center gap-[11px]">
                    <span className="grid size-[22px] shrink-0 place-items-center rounded-[7px] bg-chip text-muted-deep">
                      <HugeiconsIcon icon={g.icon} size={13} strokeWidth={1.5} />
                    </span>
                    <span className="text-[12.5px] font-semibold text-strong">{g.label}</span>
                    <span className="font-mono text-[11px] text-sand">{items.length}</span>
                    <span className="h-px flex-1 bg-divider" />
                    <span className="text-[11px] text-sand">{g.hint}</span>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-3">
                    {items.map((s) => (
                      <ServiceCard key={s.id} service={s} to={servicePath(s.id)} serverName={s.serverId ? serverName.get(s.serverId) : undefined} />
                    ))}
                  </div>
                </section>
              );
            })}
        </div>
      </div>

      {env && <AddServiceModal open={adding} onClose={() => setAdding(false)} env={env} servicePath={servicePath} />}
      {newEnv && <EnvironmentModal projectId={project.id} onClose={() => setNewEnv(false)} onCreated={(e) => selectEnv(e.id)} />}
    </>
  );
}
