import { Breadcrumbs } from "../../components/layout/Breadcrumbs";
import { SectionHeader } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { useProjectContext } from "../../features/projects/hooks/useProjectContext";
import { VariablesPanel } from "../../features/variables/components/VariablesPanel";
import { atLeast } from "../../utils/roles";

export default function ProjectVariablesPage() {
  const { project, env, withEnv } = useProjectContext();
  const { user } = useAuth();
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Projects", to: "/projects" },
          {
            label: project.projectName,
            to: withEnv(`/projects/${project.id}`),
          },
          { label: "Variables" },
        ]}
      />
      <SectionHeader
        title="Variables"
        sub={
          env ? (
            <>
              Shared by every service in{" "}
              <span className="font-mono text-body">{env.environmentName}</span>
              . A service's own variable with the same key overrides it.
            </>
          ) : undefined
        }
      />
      <div className="mt-5">
        {env ? (
          <VariablesPanel
            key={env.id}
            owner={{ kind: "environment", id: env.id }}
            canEdit={atLeast(user?.role, "DEVELOPER")}
            summary="changes apply on each service's next deploy"
          />
        ) : (
          <EmptyState title="No environments">
            Variables belong to an environment. Create one in Project settings.
          </EmptyState>
        )}
      </div>
    </>
  );
}
