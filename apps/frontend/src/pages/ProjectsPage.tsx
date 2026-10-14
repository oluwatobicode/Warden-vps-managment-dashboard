import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignCircleIcon } from "@hugeicons/core-free-icons";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { useAuth } from "../features/auth/hooks/useAuth";
import { useProjects } from "../features/projects/hooks/useProjects";
import { ProjectCards, ProjectCardsSkeleton } from "../features/projects/components/ProjectCards";
import { CreateProjectModal } from "../features/projects/components/CreateProjectModal";
import { atLeast } from "../utils/roles";
import { apiMessage } from "../utils/apiMessage";

export default function ProjectsPage() {
  const { user } = useAuth();
  const projects = useProjects();
  const [creating, setCreating] = useState(false);
  const canCreate = atLeast(user?.role, "DEV_OPS");

  const newProject = canCreate && (
    <button
      type="button"
      onClick={() => setCreating(true)}
      className="flex shrink-0 cursor-pointer items-center gap-2 rounded-3xl border border-good px-5 py-3 text-[13px] font-semibold whitespace-nowrap text-good hover:bg-good-s"
    >
      <HugeiconsIcon icon={PlusSignCircleIcon} size={14} strokeWidth={1.5} />
      New project
    </button>
  );

  return (
    <>
      <PageHeader
        title="Projects"
        aside={
          <>
            {projects.data && (
              <span className="text-sm text-muted-warm">
                {projects.data.length} project{projects.data.length === 1 ? "" : "s"}
              </span>
            )}
            {newProject}
          </>
        }
      />

      {projects.isPending && <ProjectCardsSkeleton />}

      {projects.isError && (
        <div className="mt-[34px] flex flex-col items-start gap-3">
          <p className="text-sm text-muted-warm">{apiMessage(projects.error)}</p>
          <Button variant="secondary" onClick={() => projects.refetch()}>Try again</Button>
        </div>
      )}

      {projects.data?.length === 0 && (
        <div className="mt-[34px] flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-fieldb px-6 py-14 text-center">
          <p className="font-display text-lg font-bold text-strong">No projects yet</p>
          <p className="max-w-sm text-[13px] text-muted-warm">
            {canCreate
              ? "A project groups the environments and services of one product. Create the first one."
              : "Ask a DevOps or Admin member to create the first project."}
          </p>
          {canCreate && <Button onClick={() => setCreating(true)} className="mt-2">Create project</Button>}
        </div>
      )}

      {!!projects.data?.length && <ProjectCards projects={projects.data} />}

      <CreateProjectModal open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
