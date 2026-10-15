import { useOutletContext } from "react-router";
import type { Environment, ProjectDetail } from "shared-types";

export interface ProjectContext {
  project: ProjectDetail;
  environments: Environment[];
  env: Environment | undefined;
  selectEnv: (id: string) => void;
  withEnv: (path: string) => string;
  /** Opens the Add service modal (owned by the layout, so the navbar can too). */
  openAddService: () => void;
}

export const useProjectContext = () => useOutletContext<ProjectContext>();
