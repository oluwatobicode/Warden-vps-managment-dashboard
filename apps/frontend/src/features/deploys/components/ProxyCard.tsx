import toast from "react-hot-toast";
import type { Server } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { apiMessage } from "../../../utils/apiMessage";
import { timeAgo } from "../../../utils/formatDate";
import { ProxySetupError, useProxyStatus, useSetupProxy } from "../hooks/useDeploys";

/**
 * The server's front door (Traefik on ports 80/443). Apps can't be reached
 * until it's set up. Setting it up again is safe: it's recreated with the
 * current settings, and certificates are kept.
 */
export function ProxyCard({ server, canEdit, editorReady }: { server: Pick<Server, "id" | "serverName" | "serverType">; canEdit: boolean; editorReady?: boolean }) {
  const status = useProxyStatus(server.id);
  const setup = useSetupProxy(server.id);

  if (server.serverType !== "DEPLOY") return null;
  const installedAt = status.data?.installedAt;
  // Set up before the config editor existed: needs one update (Traefik restarts).
  const outdated = !!installedAt && editorReady === false;
  const onSetup = () =>
    setup.mutate(undefined, {
      onSuccess: () => toast.success(`The proxy is running on ${server.serverName}`),
      onError: (e) => toast.error(e instanceof ProxySetupError ? e.message : apiMessage(e)),
    });

  return (
    <Card
      title="Proxy"
      sub="Traefik on ports 80 and 443: it sends each visitor to the right app and gets HTTPS certificates. Apps never open ports of their own."
      action={
        canEdit && (
          <Button variant={installedAt ? "secondary" : "primary"} loading={setup.isPending} onClick={onSetup} className="whitespace-nowrap">
            {outdated ? "Update proxy" : installedAt ? "Set up again" : "Set up proxy"}
          </Button>
        )
      }
    >
      <p className={`mt-3 text-[12px] ${installedAt && !setup.isPending && !outdated ? "text-good" : "text-warn"}`}>
        {setup.isPending
          ? "Setting it up… (the first time downloads Traefik)"
          : outdated
            ? "Running, but set up before the config editor existed. Update it to turn the editor on: Traefik restarts, so this server's sites are unreachable for 2–3 seconds."
            : installedAt
            ? `Running · set up ${timeAgo(installedAt)}`
            : "Not set up yet. Ports 80 and 443 must be free and open in the cloud firewall (on GCP: Allow HTTP and HTTPS traffic)."}
      </p>
    </Card>
  );
}
