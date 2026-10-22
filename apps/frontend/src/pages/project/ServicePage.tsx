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
import { apiMessage, apiStatus } from "../../utils/apiMessage";
import { DatabasePanel } from "../../features/databases/components/DatabasePanel";
import { atLeast } from "../../utils/roles";
import { DatabaseLogo } from "../../features/databases/components/DatabaseLogo";
import { engineOf } from "../../features/databases/engine";
import { DeploysPanel } from "../../features/deploys/components/DeploysPanel";
import { DeploymentView } from "../../features/deploys/components/DeploymentView";
import { BuildSettingsForm } from "../../features/deploys/components/BuildSettingsForm";
import { GithubRepoPicker } from "../../features/deploys/components/GithubRepoPicker";
import { DomainsCard } from "../../features/deploys/components/DomainsCard";
import { useDeployInfo } from "../../features/deploys/hooks/useDeploys";

type Tab = "deployments" | "variables" | "settings";
type Section = "general" | "build" | "github" | "domains" | "delete";

export default function ServicePage() {
  const { serviceId = "", deploymentId } = useParams();
  const { project, environments, withEnv } = useProjectContext();
  const { user } = useAuth();
  const navigate = useNavigate();
  const service = useService(serviceId);
  const servers = useServers();
  const del = useDeleteService(serviceId);
  const [tab, setTab] = useState<Tab>("deployments");
  const [section, setSection] = useState<Section>("general");
  const deployInfo = useDeployInfo(serviceId);
  const [view, setView] = useState<"own" | "resolved">("own");
  const [deleting, setDeleting] = useState(false);
  const [forcing, setForcing] = useState(false);

  if (service.isPending) return <FullPageSpinner />;
  if (service.isError) return <p className="text-sm text-crit">{apiMessage(service.error, "This service doesn't exist")}</p>;

  const s = service.data;
  const env = environments.find((e) => e.id === s.environmentId);
  const server = servers.data?.find((x) => x.id === s.serverId);
  const canEdit = atLeast(user?.role, "DEVELOPER");
  const overview = withEnv(`/projects/${project.id}`);
  const fromImage = !!s.image && !s.githubRepoUrl;
  const settingsTabs: Array<{ id: Section; label: string }> = [
    { id: "general", label: "General" },
    // A prebuilt image has nothing to build and no repo to connect.
    ...(fromImage ? [] : [{ id: "build" as const, label: "Build & start" }, { id: "github" as const, label: "GitHub App" }]),
    ...(s.type === "APPLICATION" ? [{ id: "domains" as const, label: "Domains" }] : []),
    ...(canEdit ? [{ id: "delete" as const, label: "Delete" }] : []),
  ];
  const servicePath = withEnv(`/projects/${project.id}/services/${s.id}`);
  const deployPath = (id: string) => withEnv(`/projects/${project.id}/services/${s.id}/deployments/${id}`);
  const facts = [TYPE_LABEL[s.type], sourceLabel(s), s.branch ?? env?.branch ?? null, server?.serverName ?? "no server", s.port ? `:${s.port}` : null].filter(Boolean);

  // Deleting takes the app off its server first. If the server can't be
  // reached (502), offer "Delete anyway", which leaves its containers there.
  const onDelete = (force = false) =>
    del.mutate(force, {
      onSuccess: ({ leftovers }) => {
        if (leftovers.length) {
          toast.error(`${s.serviceName} deleted, but ${leftovers[0].serverName} couldn't be reached: its containers are still there. Remove them with: ${leftovers[0].command}`, { duration: 15000 });
        } else toast.success(`${s.serviceName} deleted`);
        navigate(overview, { replace: true });
      },
      onError: (e) => {
        setDeleting(false);
        if (apiStatus(e) === 502) setForcing(true);
        else toast.error(apiMessage(e));
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

  // One deploy's page: its steps and live output.
  if (deploymentId) {
    return (
      <>
        {header}
        <button type="button" onClick={() => navigate(servicePath)} className="mt-1 cursor-pointer text-[12px] text-sand hover:text-strong">
          ← All deployments
        </button>
        <DeploymentView service={s} deploymentId={deploymentId} canEdit={canEdit} onRolledBack={(id) => navigate(deployPath(id))} />
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
          { id: "deployments", label: "Deployments" },
          { id: "variables", label: "Variables" },
          { id: "settings", label: "Settings" },
        ]}
      />

      {tab === "deployments" && <DeploysPanel service={s} canEdit={canEdit} deployPath={deployPath} />}

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
        <div className="mt-[18px] grid grid-cols-[180px_minmax(0,1fr)] items-start gap-5 pb-2">
          <nav role="tablist" aria-label="Service settings" aria-orientation="vertical" className="sticky top-0 flex flex-col gap-0.5">
            {settingsTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={section === t.id}
                onClick={() => setSection(t.id)}
                className={`cursor-pointer rounded-[10px] px-3 py-2.5 text-left text-[12.5px] font-semibold ${section === t.id ? "bg-[#24262c] text-white" : t.id === "delete" ? "text-crit/80 hover:text-crit" : "text-[#7c8088] hover:text-strong"}`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="flex min-w-0 flex-col gap-3.5">
            {section === "general" && (
              <>
                <Card title="Source & runtime" sub="Takes effect on the next deploy.">
                  <EditServiceForm service={s} canEdit={canEdit} />
                </Card>
                <Card title="Server" sub="Only deploy servers run services. A running service can't be moved.">
                  <ServerAssignment service={s} canEdit={canEdit} />
                </Card>
              </>
            )}
            {section === "build" && deployInfo.data && (
              <Card title="Build & start" sub="How Warden turns the repo into a running app. Used from the next deploy.">
                <BuildSettingsForm service={s} settings={deployInfo.data.settings} canEdit={canEdit} />
              </Card>
            )}
            {section === "github" && deployInfo.data && (
              <Card title="GitHub App" sub="For private repos and deploy-on-push.">
                <GithubRepoPicker service={s} settings={deployInfo.data.settings} canEdit={canEdit} />
              </Card>
            )}
            {section === "domains" && deployInfo.data && <DomainsCard service={s} info={deployInfo.data} canEdit={canEdit} />}
            {section === "delete" && (
              <DangerZone
                body={
                  s.serverId
                    ? `Stops ${s.serviceName} on ${server?.serverName ?? "its server"} and removes it there (its containers, address and kept versions), then deletes it with its variables, domains and deploy history. Environment variables are not affected.`
                    : `Deletes ${s.serviceName} and its own variables. Environment variables are not affected.`
                }
                action={<Button variant="danger" onClick={() => setDeleting(true)}>Delete service</Button>}
              />
            )}
            {(section === "build" || section === "github" || section === "domains") && deployInfo.isPending && <Card title="Loading…" />}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => onDelete(false)}
        loading={del.isPending}
        title={`Delete ${s.serviceName}?`}
        body={s.serverId ? `It stops serving straight away and is removed from ${server?.serverName ?? "its server"}. Its own variables and deploy history are deleted too. This can't be undone.` : "Its own variables are deleted with it. This can't be undone."}
        cta="Delete service"
        phrase={s.serviceName}
      />
      <ConfirmDialog
        open={forcing}
        onClose={() => setForcing(false)}
        onConfirm={() => {
          setForcing(false);
          onDelete(true);
        }}
        loading={del.isPending}
        title={`Couldn't reach ${server?.serverName ?? "the server"}`}
        body={`Nothing was removed. Delete ${s.serviceName} from Warden anyway? Its containers then stay on the server until you remove them by hand (Warden shows you the command).`}
        cta="Delete anyway"
      />
    </>
  );
}
