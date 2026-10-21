import { useState } from "react";
import { Link } from "react-router";
import toast from "react-hot-toast";
import type { Service } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { apiMessage } from "../../../utils/apiMessage";
import { useServers } from "../../servers/hooks/useServers";
import { useAssignServer } from "../hooks/useServices";
import { serverOption } from "../../servers/serverOption";

/**
 * Which DEPLOY server runs this service. The API refuses to move a service
 * that's running (its container would be left behind), and only DEPLOY
 * servers run services; build servers are filtered out here too.
 */
export function ServerAssignment({ service, canEdit }: { service: Service; canEdit: boolean }) {
  const servers = useServers();
  const assign = useAssignServer(service.id);
  const [picked, setPicked] = useState(service.serverId ?? "");

  const deployServers = (servers.data ?? []).filter((s) => s.serverType === "DEPLOY");
  const changed = picked !== (service.serverId ?? "");

  const save = () =>
    assign.mutate(
      { serverId: picked || null },
      {
        onSuccess: () => toast.success(picked ? "Server assigned" : "Service removed from its server"),
        onError: (e) => {
          toast.error(apiMessage(e));
          setPicked(service.serverId ?? "");
        },
      },
    );

  return (
    <div className="mt-3.5 flex flex-col gap-3.5">
      <Select
        label="Deploy server"
        value={picked}
        onChange={setPicked}
        disabled={!canEdit || servers.isPending}
        placeholder="No server"
        options={deployServers.map(serverOption)}
      />
      {servers.data && deployServers.length === 0 && (
        <p className="m-0 text-[11.5px] text-sand">
          No deploy servers yet. <Link to="/settings/servers" className="text-link">Add one in Settings</Link>.
        </p>
      )}
      {canEdit && (
        <Button onClick={save} disabled={!changed} loading={assign.isPending} className="self-start">
          {picked ? "Assign server" : "Unassign"}
        </Button>
      )}
    </div>
  );
}
