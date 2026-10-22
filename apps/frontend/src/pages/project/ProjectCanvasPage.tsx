import { useCallback, useMemo, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import toast from "react-hot-toast";
import { HugeiconsIcon } from "@hugeicons/react";
import { LayoutGridIcon } from "@hugeicons/core-free-icons";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { useProjectContext } from "../../features/projects/hooks/useProjectContext";
import { useServices } from "../../features/services/hooks/useServices";
import { useServers } from "../../features/servers/hooks/useServers";
import { ServiceCard } from "../../features/services/components/ServiceCard";
import { ServiceCanvas } from "../../features/canvas/components/ServiceCanvas";
import { useSaveCanvasPositions } from "../../features/canvas/hooks/useCanvasPositions";
import { tidyLayout } from "../../features/canvas/layout";
import { apiMessage } from "../../utils/apiMessage";
import { atLeast } from "../../utils/roles";

/**
 * /projects/:id/canvas : the selected environment's services as boxes on a
 * board. The layout is shared by the team and saved per environment. On a
 * phone it shows the plain list instead (dragging boxes on a small touch
 * screen is painful).
 */
export default function ProjectCanvasPage() {
  const { project, env, withEnv, openAddService } = useProjectContext();
  const { user } = useAuth();
  const services = useServices(env?.id);
  const servers = useServers();
  const save = useSaveCanvasPositions(env?.id ?? "");
  const [tidying, setTidying] = useState(false);

  const names = useMemo(() => new Map((servers.data ?? []).map((s) => [s.id, s.serverName])), [servers.data]);
  const serverName = useCallback((id: string | null) => (id ? names.get(id) : undefined), [names]);
  const servicePath = useCallback((id: string) => withEnv(`/projects/${project.id}/services/${id}`), [withEnv, project.id]);
  const list = services.data ?? [];
  const canAdd = atLeast(user?.role, "DEVELOPER");

  const onTidy = () =>
    save.mutate(tidyLayout(list), {
      onSuccess: () => {
        setTidying(false);
        toast.success("Layout tidied for everyone");
      },
      onError: (e) => toast.error(apiMessage(e)),
    });

  if (!env) return <EmptyState title="No environments">Create an environment in project settings to see its services here.</EmptyState>;

  return (
    <div className="flex h-full min-h-[560px] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-[12.5px] text-sand">
          <span className="font-mono text-body">{env.environmentName}</span> · {list.length} service{list.length === 1 ? "" : "s"} · drag to arrange, the layout is shared with your team
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setTidying(true)} disabled={list.length < 2} className="px-3.5 py-2 text-xs">
            <HugeiconsIcon icon={LayoutGridIcon} size={14} strokeWidth={1.5} />
            Tidy up
          </Button>
          {canAdd && (
            <Button onClick={openAddService} className="px-3.5 py-2 text-xs">
              Add service
            </Button>
          )}
        </div>
      </div>

      {services.isPending && <Skeleton className="flex-1 rounded-2xl" />}
      {services.isError && <p className="text-sm text-crit">{apiMessage(services.error)}</p>}
      {services.data && !list.length && (
        <EmptyState title="No services in this environment" action={canAdd && <Button onClick={openAddService}>Add service</Button>}>
          Services you add show up here as boxes you can arrange.
        </EmptyState>
      )}

      {!!list.length && (
        <>
          <div className="hidden min-h-0 flex-1 md:block">
            <ReactFlowProvider>
              <ServiceCanvas environmentId={env.id} services={list} serverName={serverName} servicePath={servicePath} />
            </ReactFlowProvider>
          </div>
          <div className="grid gap-2.5 md:hidden">
            {list.map((s) => (
              <ServiceCard key={s.id} service={s} to={servicePath(s.id)} serverName={serverName(s.serverId)} />
            ))}
          </div>
        </>
      )}

      <ConfirmDialog
        open={tidying}
        onClose={() => setTidying(false)}
        onConfirm={onTidy}
        loading={save.isPending}
        title="Tidy up the canvas?"
        body={`Every box in ${env.environmentName} moves to a neat grid, for everyone on your team.`}
        cta="Tidy up"
      />
    </div>
  );
}
