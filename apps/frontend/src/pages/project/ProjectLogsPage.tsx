import { useMemo } from "react";
import { SectionHeader } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { LogViewer } from "../../features/logs/components/LogViewer";
import { useProjectContext } from "../../features/projects/hooks/useProjectContext";
import { useServices } from "../../features/services/hooks/useServices";
import { apiMessage } from "../../utils/apiMessage";
import { atLeast } from "../../utils/roles";

/**
 * Every service in the selected environment in one stream, each line tagged
 * with its service. Developer and up, like a service's Logs tab.
 */
export default function ProjectLogsPage() {
  const { env } = useProjectContext();
  const { user } = useAuth();
  const allowed = atLeast(user?.role, "DEVELOPER");
  const services = useServices(allowed ? env?.id : undefined);
  const list = useMemo(() => (services.data ?? []).map((s) => ({ id: s.id, name: s.serviceName })), [services.data]);

  const body = !allowed ? (
    <EmptyState title="Logs are for Developers and up">App logs can contain things not everyone should see. Ask an Admin if you need access.</EmptyState>
  ) : !env ? (
    <EmptyState title="No environment yet">Create an environment and add a service; its logs show up here.</EmptyState>
  ) : services.isPending ? (
    <Spinner />
  ) : services.isError ? (
    <p className="text-sm text-crit">{apiMessage(services.error, "Couldn't load the services")}</p>
  ) : !list.length ? (
    <EmptyState title="No services in this environment">Add a service; what it prints shows up here.</EmptyState>
  ) : (
    // key: another environment (or a service added/removed) starts a fresh view and live watch
    <LogViewer key={`${env.id}:${list.map((s) => s.id).join(",")}`} scope={{ environmentId: env.id }} services={list} />
  );

  return (
    <>
      <SectionHeader title="Logs" sub={`What every service in ${env?.environmentName ?? "this environment"} prints, live and kept 7 days, newest at the bottom.`} />
      <div className="mt-[4px]">{body}</div>
    </>
  );
}
