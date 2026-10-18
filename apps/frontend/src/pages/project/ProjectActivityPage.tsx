import { useMemo } from "react";
import { SectionHeader } from "../../components/ui/Card";
import { useProjectContext } from "../../features/projects/hooks/useProjectContext";
import { ActivityList } from "../../features/audit-logs/components/ActivityList";

/**
 * A project's Activity tab: who did what in THIS project. Every role can see
 * it (decided 2026-10-18); the org-wide audit log stays Admin-only.
 */
export default function ProjectActivityPage() {
  const { project } = useProjectContext();
  const source = useMemo(() => ({ kind: "project" as const, projectId: project.id }), [project.id]);
  return (
    <>
      <SectionHeader
        title="Activity"
        sub={`Who did what in ${project.projectName}, newest first: environments, imports, and which secrets were revealed (never their values).`}
      />
      <div className="mt-[22px]">
        {/* key: a different project starts back on page 1 */}
        <ActivityList
          key={project.id}
          source={source}
          emptyTitle="Nothing recorded yet"
          emptyText="Creating environments, importing variables and revealing secrets in this project show up here."
        />
      </div>
    </>
  );
}
