import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import toast from "react-hot-toast";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { Button } from "../../components/ui/Button";
import { Card, DangerZone, FactRow } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatusPill } from "../../components/ui/StatusPill";
import { Tabs } from "../../components/ui/Tabs";
import { useAuth } from "../../features/auth/hooks/useAuth";
import {
  useDeleteServer,
  useServer,
} from "../../features/servers/hooks/useServers";
import { ConnectionTestModal } from "../../features/servers/components/ConnectionTestModal";
import { EditServerForm } from "../../features/servers/components/EditServerForm";
import { ResourcesTab } from "../../features/servers/components/ResourcesTab";
import { ContainersTab } from "../../features/servers/components/ContainersTab";
import { CleanupModal } from "../../features/servers/components/CleanupModal";
import { ProxyTab } from "../../features/proxy/components/ProxyTab";
import { serverWhere } from "../../features/servers/components/serverLabels";
import { apiMessage } from "../../utils/apiMessage";
import { formatDate, timeAgo } from "../../utils/formatDate";
import { atLeast } from "../../utils/roles";

type Tab = "resources" | "containers" | "proxy" | "details" | "danger";

export default function ServerPage() {
  const { serverId = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const server = useServer(serverId);
  const del = useDeleteServer(serverId);
  const [tab, setTab] = useState<Tab>("resources");
  const [testing, setTesting] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canEdit = atLeast(user?.role, "DEV_OPS");

  if (server.isPending) return <Skeleton className="h-40" />;
  if (server.isError)
    return (
      <p className="text-sm text-crit">
        {apiMessage(server.error, "This server doesn't exist")}
      </p>
    );
  const s = server.data;

  const onDelete = () =>
    del.mutate(undefined, {
      onSuccess: () => {
        toast.success(`${s.serverName} removed`);
        navigate("/settings/servers", { replace: true });
      },
      onError: (e) => {
        toast.error(apiMessage(e));
        setDeleting(false);
      },
    });

  return (
    <>
      <Link
        to="/settings/servers"
        className="mb-4 inline-flex items-center gap-2 text-[11.5px] text-sand hover:text-strong"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} size={12} strokeWidth={1.5} />
        Remote servers
      </Link>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="m-0 font-mono text-2xl font-semibold text-strong">
              {s.serverName}
            </h2>
            <StatusPill status={s.status} />
          </div>
          <p className="mt-2.5 text-[12.5px] text-muted-warm">
            {serverWhere(s)} ·{" "}
            {s.serverType === "BUILD" ? "Build server" : "Deploy server"} ·{" "}
            {s.serverSSHUsername}@{s.serverIp}:{s.serverPort} ·{" "}
            {s.lastSeenAt
              ? `last reached ${timeAgo(s.lastSeenAt)}`
              : "never tested"}
          </p>
        </div>
        {canEdit && (
          <span className="flex shrink-0 gap-2">
            <Button variant="secondary" onClick={() => setCleaning(true)}>
              Run cleanup
            </Button>
            <Button variant="secondary" onClick={() => setTesting(true)}>
              Test connection
            </Button>
          </span>
        )}
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "resources", label: "Resources" },
          {
            id: "containers",
            label: s.containers.total
              ? `Containers · ${s.containers.total}`
              : "Containers",
          },
          ...(s.serverType === "DEPLOY" ? [{ id: "proxy" as const, label: "Proxy" }] : []),
          { id: "details", label: "Details" },
          ...(canEdit ? [{ id: "danger" as const, label: "Danger zone" }] : []),
        ]}
      />

      {tab === "resources" && <ResourcesTab serverId={s.id} />}
      {tab === "containers" && <ContainersTab serverId={s.id} />}
      {tab === "proxy" && <ProxyTab server={s} canEdit={canEdit} />}

      {tab === "details" && (
        <div className="mt-5 grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-start gap-3.5 pb-2">
          <Card
            title="Connection"
            sub="Changing the address, user or key marks it Offline until Warden reaches it again, usually within a minute."
          >
            <EditServerForm server={s} canEdit={canEdit} />
          </Card>
          <Card title="About">
            <div className="mt-3">
              <FactRow label="Services on it">{s.serviceCount}</FactRow>
              <FactRow label="SSH key">{s.sshKey.sshKeyName}</FactRow>
              <FactRow label="Fingerprint">
                {s.sshKey.fingerprint.replace("SHA256:", "").slice(0, 16)}…
              </FactRow>
              <FactRow label="Added">{formatDate(s.createdAt)}</FactRow>
            </div>
          </Card>
        </div>
      )}

      {tab === "danger" && canEdit && (
        <div className="mt-5">
          <DangerZone
            body={
              s.serviceCount
                ? `${s.serverName} still runs ${s.serviceCount} service(s). Move or unassign them first; Warden won't leave containers behind.`
                : `Removing ${s.serverName} stops Warden from managing it. Nothing on the host itself is touched.`
            }
            action={
              <Button variant="danger" onClick={() => setDeleting(true)}>
                Remove server
              </Button>
            }
          />
        </div>
      )}

      {testing && (
        <ConnectionTestModal server={s} onClose={() => setTesting(false)} />
      )}
      {cleaning && (
        <CleanupModal server={s} onClose={() => setCleaning(false)} />
      )}
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={onDelete}
        loading={del.isPending}
        title={`Remove ${s.serverName} from Warden?`}
        body="Warden forgets this host. Its SSH key stays in your keys."
        cta="Remove server"
        phrase={s.serverName}
      />
    </>
  );
}
