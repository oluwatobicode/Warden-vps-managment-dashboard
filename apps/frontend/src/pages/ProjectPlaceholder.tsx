import { Link, useParams } from "react-router";
import { useProject } from "../features/projects/hooks/useProjects";

export default function ProjectPlaceholder() {
  const { projectId = "" } = useParams();
  const project = useProject(projectId);
  return (
    <div className="p-8">
      <Link
        to="/projects"
        className="text-xs text-muted-warm hover:text-strong"
      >
        ← All projects
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-strong">
        {project.data?.projectName ?? "…"}
      </h1>
      <p className="mt-2 text-sm text-muted-warm">
        The project page is built in F3.
      </p>
    </div>
  );
}
