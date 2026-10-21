import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import toast from "react-hot-toast";
import { Breadcrumbs } from "../../components/layout/Breadcrumbs";
import { Button } from "../../components/ui/Button";
import { Card, DangerZone } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { FullPageSpinner } from "../../components/ui/Spinner";
import { StatusPill } from "../../components/ui/StatusPill";
import { Tabs } from "../../components/ui/Tabs";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { useProjectContext } from "../../features/projects/hooks/useProjectContext";
import { useDeleteService, useService } from "../../features/services/hooks/useServices";
import { useServers } from "../../features/servers/hooks/useServers";
import { EditServiceForm } from "../../features/services/components/EditServiceForm";
import { ServerAssignment } from "../../features/services/components/ServerAssignment";
import { TYPE_LABEL, sourceLabel } from "../../features/services/components/serviceLabels";
import { VariablesPanel } from "../../features/variables/components/VariablesPanel";
import { ResolvedVariables } from "../../features/variables/components/ResolvedVariables";
import { apiMessage } from "../../utils/apiMessage";
import { DatabasePanel } from "../../features/databases/components/DatabasePanel";
import { atLeast } from "../../utils/roles";
import { DatabaseLogo } from "../../features/databases/components/DatabaseLogo";
import { engineOf } from "../../features/databases/engine";

type Tab = "variables" | "settings";

export default function ServicePage() {
  const { serviceId = "" } = useParams();
  const { project, environments, withEnv } = useProjectContext();
  const { user } = useAuth();
  const navigate = useNavigate();
  const service = useService(serviceId);
  const servers = useServers();
  const del = useDeleteService(serviceId);
  const [tab, setTab] = useState<Tab>("variables");
  const [view, setView] = useState<"own" | "resolved">("own");
  const [deleting, setDeleting] = useState(false);

  if (service.isPending) return <FullPageSpinner />;
  if (service.isError) return <p className="text-sm text-crit">{apiMessage(service.error, "This service doesn't exist")}</p>;

  const s = service.data;
  const env = environments.find((e) => e.id === s.environmentId);
  const server = servers.data?.find((x) => x.id === s.serverId);
  const canEdit = atLeast(user?.role, "DEVELOPER");
  const overview = withEnv(`/projects/${project.id}`);
  const facts = [TYPE_LABEL[s.type], sourceLabel(s), s.branch ?? env?.branch ?? null, server?.serverName ?? "no server", s.port ? `:${s.port}` : null].filter(Boolean);

  const onDelete = () =>
    del.mutate(undefined, {
      onSuccess: () => {
        toast.success(`${s.serviceName} deleted`);
        navigate(overview, { replace: true });
      },
      onError: (e) => {
        toast.error(apiMessage(e));
        setDeleting(false);
      },
    });

  const engine = engineOf(s);
  const header = (
    <>
      <Breadcrumbs
        items={[
          { label: "Projects", to: "/projects" },
          { label: project.projectName, to: overview },
          { label: env?.environmentName ?? "environment", to: overview },
          { label: s.serviceName },
        ]}
      />
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {engine && <DatabaseLogo engine={engine} size={24} />}
            <h2 className="m-0 font-mono text-[25px] font-semibold tracking-[-0.5px] text-strong">{s.serviceName}</h2>
            <StatusPill status={s.status} />
          </div>
          <p className="mt-2.5 font-mono text-[12.5px] text-muted-warm">{facts.join(" · ")}</p>
        </div>
      </div>

    </>
  );

  // A database has its own page body: connection, deploy log, restart, delete.
  if (s.type === "DATABASE") {
    return (
      <>
        {header}
        <DatabasePanel service={s} canEdit={canEdit} afterDelete={overview} />
      </>
    );
  }

  return (
    <>
      {header}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "variables", label: "Variables" },
          { id: "settings", label: "Settings" },
        ]}
      />

      {tab === "variables" && (
        <div className="mt-[18px] pb-2">
          <div role="radiogroup" className="mb-4 inline-flex rounded-lg border border-cb bg-seg p-[3px]">
            {(
              [
                ["own", "This service's variables"],
                ["resolved", "What the container gets"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={view === id}
                onClick={() => setView(id)}
                className={`cursor-pointer rounded-md px-3 py-[5px] text-[11px] ${view === id ? "bg-track text-strong" : "text-sand hover:text-strong"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {view === "own" ? (
            <VariablesPanel
              owner={{ kind: "service", id: s.id }}
              canEdit={canEdit}
              summary={`same key as ${env?.environmentName ?? "the environment"} overrides it`}
            />
          ) : (
            <ResolvedVariables serviceId={s.id} />
          )}
        </div>
      )}

      {tab === "settings" && (
        <div className="mt-[18px] grid grid-cols-2 items-start gap-3.5 pb-2">
          <Card title="Source & runtime" sub="Takes effect on the next deploy.">
            <EditServiceForm service={s} canEdit={canEdit} />
          </Card>
          <Card title="Server" sub="Only deploy servers run services. A running service can't be moved.">
            <ServerAssignment service={s} canEdit={canEdit} />
          </Card>
          {canEdit && (
            <div className="col-span-2">
              <DangerZone
                body={
                  s.serverId
                    ? `${s.serviceName} is on ${server?.serverName ?? "a server"}. Unassign it first, then it can be deleted with its variables.`
                    : `Deletes ${s.serviceName} and its own variables. Environment variables are not affected.`
                }
                action={<Button variant="danger" onClick={() => setDeleting(true)}>Delete service</Button>}
              />
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={onDelete}
        loading={del.isPending}
        title={`Delete ${s.serviceName}?`}
        body="Its own variables are deleted with it. This can't be undone."
        cta="Delete service"
        phrase={s.serviceName}
      />
    </>
  );
}
