import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignCircleIcon } from "@hugeicons/core-free-icons";
import { Button } from "../../components/ui/Button";
import { SectionHeader } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { useServers } from "../../features/servers/hooks/useServers";
import { ServerRow } from "../../features/servers/components/ServerRow";
import { AddServerDrawer } from "../../features/servers/components/AddServerDrawer";
import { apiMessage } from "../../utils/apiMessage";
import { atLeast } from "../../utils/roles";

export default function ServersPage() {
  const { user } = useAuth();
  const servers = useServers();
  const [adding, setAdding] = useState(false);
  const canEdit = atLeast(user?.role, "DEV_OPS");

  return (
    <>
      <SectionHeader
        title="Remote servers"
        sub="Warden reaches every host over SSH. Build servers make images; deploy servers run containers."
        action={
          canEdit && (
            <Button onClick={() => setAdding(true)}>
              <HugeiconsIcon icon={PlusSignCircleIcon} size={14} strokeWidth={1.5} />
              Add server
            </Button>
          )
        }
      />
      <div className="mt-[22px] flex flex-col gap-2.5 pb-2">
        {servers.isPending && [0, 1].map((i) => <Skeleton key={i} className="h-[74px] rounded-2xl" />)}
        {servers.isError && <p className="text-sm text-crit">{apiMessage(servers.error)}</p>}
        {servers.data?.length === 0 && (
          <EmptyState title="No servers yet" action={canEdit && <Button onClick={() => setAdding(true)}>Add server</Button>}>
            Add the VPS your services will run on. You'll need an SSH key whose public half is in the server's authorized_keys.
          </EmptyState>
        )}
        {servers.data?.map((s) => <ServerRow key={s.id} server={s} />)}
      </div>
      <AddServerDrawer open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
