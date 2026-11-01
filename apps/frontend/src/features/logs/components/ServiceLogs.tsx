import type { Service } from "shared-types";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useAuth } from "../../auth/hooks/useAuth";
import { useDeployments } from "../../deploys/hooks/useDeploys";
import { atLeast } from "../../../utils/roles";
import { LogViewer } from "./LogViewer";

/** A service's Logs tab. Developer and up: logs often hold things that shouldn't be shown to everyone. */
export function ServiceLogs({ service }: { service: Service }) {
  const { user } = useAuth();
  const allowed = atLeast(user?.role, "DEVELOPER");
  const deploys = useDeployments(service.id);
  if (!allowed) {
    return (
      <div className="mt-[18px]">
        <EmptyState title="Logs are for Developers and up">App logs can contain things not everyone should see. Ask an Admin if you need access.</EmptyState>
      </div>
    );
  }
  // Versions that ran (a failed build never printed app logs).
  const versions = (deploys.data ?? [])
    .filter((d) => d.status === "SUCCESS" || d.live)
    .slice(0, 20)
    .map((d) => ({ id: d.id, label: `#${d.number}${d.live ? " · live" : ""}` }));
  return <LogViewer key={service.id} scope={{ serviceId: service.id }} services={[{ id: service.id, name: service.serviceName }]} deployments={versions} />;
}
