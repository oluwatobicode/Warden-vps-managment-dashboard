import { useOutletContext } from "react-router";
import type { Environment, ProjectDetail } from "shared-types";

export interface ProjectContext {
  project: ProjectDetail;
  environments: Environment[];
  env: Environment | undefined;
  selectEnv: (id: string) => void;
  withEnv: (path: string) => string;
}

export const useProjectContext = () => useOutletContext<ProjectContext>();
