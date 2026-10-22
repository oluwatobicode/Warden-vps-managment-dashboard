import { useState } from "react";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { UpdateProjectSchema, type Environment, type UpdateProjectInput } from "shared-types";
import { Breadcrumbs } from "../../components/layout/Breadcrumbs";
import { Button } from "../../components/ui/Button";
import { Card, DangerZone, FactRow, SectionHeader } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Input } from "../../components/ui/Input";
import { StatusPill } from "../../components/ui/StatusPill";
import { Tabs } from "../../components/ui/Tabs";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { useProjectContext } from "../../features/projects/hooks/useProjectContext";
import { useDeleteProject, useUpdateProject } from "../../features/projects/hooks/useProjects";
import { useDeleteEnvironment } from "../../features/environments/hooks/useEnvironments";
import { EnvironmentModal } from "../../features/environments/components/EnvironmentModal";
import { applyApiIssues, apiMessage, apiStatus } from "../../utils/apiMessage";
import { formatDate } from "../../utils/formatDate";
import { optionalText } from "../../utils/forms";
import { atLeast } from "../../utils/roles";
import { useServers } from "../../features/servers/hooks/useServers";

type Tab = "general" | "environments" | "danger";

export default function ProjectSettingsPage() {
  const { project, environments, env, selectEnv, withEnv } = useProjectContext();
  const { user } = useAuth();
  const canEdit = atLeast(user?.role, "DEV_OPS");
  const [tab, setTab] = useState<Tab>("general");

  return (
    <>
      <Breadcrumbs items={[{ label: "Projects", to: "/projects" }, { label: project.projectName, to: withEnv(`/projects/${project.id}`) }, { label: "Settings" }]} />
      <SectionHeader title="Project settings" sub={`Applies to every environment in ${project.projectName}.`} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "general", label: "General" },
          { id: "environments", label: "Environments" },
          ...(canEdit ? [{ id: "danger" as const, label: "Danger zone" }] : []),
        ]}
      />
      <div className="mt-[18px] pb-2">
        {tab === "general" && <GeneralTab canEdit={canEdit} />}
        {tab === "environments" && <EnvironmentsTab canEdit={canEdit} environments={environments} selectedId={env?.id} onSelect={selectEnv} />}
        {tab === "danger" && canEdit && <DangerTab />}
      </div>
    </>
  );
}

function GeneralTab({ canEdit }: { canEdit: boolean }) {
  const { project } = useProjectContext();
  const update = useUpdateProject(project.id);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateProjectInput>({
    resolver: zodResolver(UpdateProjectSchema),
    values: { projectName: project.projectName, projectDescription: project.projectDescription ?? "" },
  });

  const onSubmit = (input: UpdateProjectInput) =>
    update.mutate(input, {
      onSuccess: () => {
        toast.success("Project updated");
        reset(undefined, { keepValues: true });
      },
      onError: (e) => {
        if (applyApiIssues(e, setError)) return;
        if (apiStatus(e) === 409) return setError("projectName", { message: apiMessage(e) });
        toast.error(apiMessage(e));
      },
    });

  return (
    <div className="grid grid-cols-2 items-start gap-3.5">
      <Card title="General">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4 flex flex-col gap-[15px]">
          <fieldset disabled={!canEdit} className="flex flex-col gap-[15px] disabled:opacity-70">
            <Input label="Project name" error={errors.projectName?.message} {...register("projectName")} />
            <Input label="Description" error={errors.projectDescription?.message} {...register("projectDescription", { setValueAs: optionalText })} />
          </fieldset>
          {canEdit && <Button type="submit" disabled={!isDirty} loading={update.isPending} className="self-start">Save changes</Button>}
        </form>
      </Card>
      <Card title="About">
        <div className="mt-3">
          <FactRow label="Slug">/{project.slug}</FactRow>
          <FactRow label="Created">{formatDate(project.createdAt)}</FactRow>
          <FactRow label="Environments">{project.environmentCount}</FactRow>
          <FactRow label="Services">{project.serviceCount}</FactRow>
        </div>
      </Card>
    </div>
  );
}

function EnvironmentsTab({ canEdit, environments, selectedId, onSelect }: { canEdit: boolean; environments: Environment[]; selectedId?: string; onSelect: (id: string) => void }) {
  const { project } = useProjectContext();
  const servers = useServers();
  const serverName = (id: string | null) => (id ? (servers.data?.find((s) => s.id === id)?.serverName ?? "a server") : "no default server");
  const del = useDeleteEnvironment(project.id);
  const [editing, setEditing] = useState<Environment | "new" | null>(null);
  const [deleting, setDeleting] = useState<Environment | null>(null);

  const onDelete = () =>
    deleting &&
    del.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(`${deleting.environmentName} deleted`);
        const rest = environments.filter((e) => e.id !== deleting.id);
        if (deleting.id === selectedId && rest[0]) onSelect(rest[0].id);
        setDeleting(null);
      },
      onError: (e) => {
        toast.error(apiMessage(e));
        setDeleting(null);
      },
    });

  return (
    <Card
      title="Environments"
      sub="A project needs at least one. Each holds its own services and variables."
      action={canEdit && <Button variant="secondary" onClick={() => setEditing("new")} className="px-3 py-[7px] text-[11px]">New environment</Button>}
    >
      <div className="mt-3">
        {environments.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 border-t border-divider py-3">
            <span className="flex min-w-0 flex-col gap-[3px]">
              <span className="font-mono text-xs text-body">{e.environmentName}</span>
              <span className="font-mono text-[10.5px] text-sand">
                {e.serviceCount} service{e.serviceCount === 1 ? "" : "s"} · branch {e.branch ?? "not set"} · {serverName(e.defaultServerId)}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <StatusPill status={e.status} />
              {canEdit && (
                <>
                  <button type="button" onClick={() => setEditing(e)} className="cursor-pointer text-[11.5px] font-semibold text-link">Edit</button>
                  <button type="button" onClick={() => setDeleting(e)} className="cursor-pointer text-[11.5px] font-semibold text-crit">Delete</button>
                </>
              )}
            </span>
          </div>
        ))}
      </div>
      {editing && (
        <EnvironmentModal projectId={project.id} editing={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onCreated={(e) => onSelect(e.id)} />
      )}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={onDelete}
        loading={del.isPending}
        title={`Delete ${deleting?.environmentName}?`}
        body="Its services and variables are deleted with it. Refused while any of its services is on a server, or if it's the project's last environment."
        cta="Delete environment"
        phrase={deleting?.environmentName}
      />
    </Card>
  );
}

function DangerTab() {
  const { project } = useProjectContext();
  const navigate = useNavigate();
  const del = useDeleteProject(project.id);
  const [open, setOpen] = useState(false);

  const onDelete = () =>
    del.mutate(undefined, {
      onSuccess: () => {
        toast.success(`${project.projectName} deleted`);
        navigate("/projects", { replace: true });
      },
      onError: (e) => {
        toast.error(apiMessage(e));
        setOpen(false);
      },
    });

  return (
    <>
      <DangerZone
        body={`Deleting ${project.projectName} removes ${project.environmentCount} environment(s) and ${project.serviceCount} service(s) with their variables. Refused while any service is still on a server.`}
        action={<Button variant="danger" onClick={() => setOpen(true)}>Delete project</Button>}
      />
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={onDelete}
        loading={del.isPending}
        title={`Delete the ${project.projectName} project?`}
        body="Every environment, service and variable inside it is deleted. This can't be undone."
        cta="Delete project"
        phrase={project.projectName}
      />
    </>
  );
}
