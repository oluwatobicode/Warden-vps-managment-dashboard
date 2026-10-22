import { useState } from "react";
import { Link, useNavigate } from "react-router";
import toast from "react-hot-toast";
import { HugeiconsIcon } from "@hugeicons/react";
import { LinkSquare02Icon, Rocket01Icon } from "@hugeicons/core-free-icons";
import type { Deployment, Service } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Skeleton } from "../../../components/ui/Skeleton";
import { StatusPill } from "../../../components/ui/StatusPill";
import { apiMessage } from "../../../utils/apiMessage";
import { formatDuration, timeAgo } from "../../../utils/formatDate";
import { isRunning, useDeployInfo, useDeployments, useStopStart, useTriggerDeploy } from "../hooks/useDeploys";
import { RollbackDialog } from "./RollbackDialog";

/** What's live, the Deploy button, and every deploy of this service. */
export function DeploysPanel({ service, canEdit, deployPath }: { service: Service; canEdit: boolean; deployPath: (id: string) => string }) {
  const navigate = useNavigate();
  const info = useDeployInfo(service.id);
  const deployments = useDeployments(service.id);
  const trigger = useTriggerDeploy(service.id);
  const stopStart = useStopStart(service.id);
  const [rollingBack, setRollingBack] = useState<Deployment | null>(null);

  const live = deployments.data?.find((d) => d.live);
  const running = deployments.data?.find((d) => isRunning(d.status));
  const web = service.type === "APPLICATION";
  // Say up front why Deploy wouldn't work, instead of letting it fail.
  const blocker = !service.githubRepoUrl && !service.image
    ? "Set a GitHub repo or an image in Settings first."
    : !service.serverId
      ? "Pick a server in Settings first."
      : web && service.port == null
        ? "Set the app's port in Settings first."
        : web && info.data && !info.data.proxyReady
          ? "proxy"
          : null;

  const stopped = service.status === "STOPPED";
  const onStopStart = () =>
    stopStart.mutate(stopped ? "start" : "stop", {
      onSuccess: () => toast.success(stopped ? `${service.serviceName} is running again` : `${service.serviceName} stopped. Start brings the same version back`),
      onError: (e) => toast.error(apiMessage(e)),
    });

  const onDeploy = () =>
    trigger.mutate(
      {},
      {
        onSuccess: (d) => {
          toast.success(`Deploy #${d.number} started`);
          navigate(deployPath(d.id));
        },
        onError: (e) => toast.error(apiMessage(e)),
      },
    );

  return (
    <div className="mt-[18px] flex flex-col gap-3.5 pb-2">
      <Card
        title={live ? (stopped ? `Stopped: #${live.number}` : `Live: #${live.number}`) : "Not deployed yet"}
        sub={live ? `${live.commitMessage ?? live.commitSha?.slice(0, 7) ?? "deployed"} · ${timeAgo(live.finishedAt ?? live.createdAt)}${live.triggeredByName ? ` · by ${live.triggeredByName}` : ""}` : "Deploy to build it and start it on its server."}
        action={
          canEdit && (
            <div className="flex items-center gap-2">
              {live && !running && (
                <Button variant="secondary" onClick={onStopStart} loading={stopStart.isPending}>
                  {stopped ? "Start" : "Stop"}
                </Button>
              )}
            <Button onClick={running ? () => navigate(deployPath(running.id)) : onDeploy} loading={trigger.isPending} disabled={!running && !!blocker}>
              <HugeiconsIcon icon={Rocket01Icon} size={14} strokeWidth={1.6} />
              {running ? `Deploying #${running.number}…` : "Deploy"}
            </Button>
            </div>
          )
        }
      >
        {info.data?.url && (
          <a href={info.data.url} target="_blank" rel="noreferrer" className="mt-3.5 inline-flex max-w-full items-center gap-1.5 font-mono text-[12.5px] text-brand hover:underline">
            <span className="truncate">{info.data.url.replace(/^https?:\/\//, "")}</span>
            <HugeiconsIcon icon={LinkSquare02Icon} size={13} strokeWidth={1.6} />
          </a>
        )}
        {blocker === "proxy" ? (
          <p className="mt-3 text-[12px] text-warn">
            The server's proxy isn't set up yet, so the app couldn't be reached.{" "}
            <Link to={`/settings/servers/${service.serverId}`} className="text-link">
              Set it up on the server's page
            </Link>
            .
          </p>
        ) : (
          blocker && <p className="mt-3 text-[12px] text-warn">{blocker}</p>
        )}
      </Card>

      <Card title="Deployments" sub="Every deploy is a version you can go back to.">
        <div className="mt-3.5">
          {deployments.isPending && <Skeleton className="h-24 rounded-xl" />}
          {deployments.isError && <p className="text-sm text-crit">{apiMessage(deployments.error)}</p>}
          {deployments.data?.length === 0 && <EmptyState title="No deploys yet">Press Deploy to build this service from its repo and start it.</EmptyState>}
          {!!deployments.data?.length && (
            <ul className="m-0 flex list-none flex-col divide-y divide-divider p-0">
              {deployments.data.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
                  <Link to={deployPath(d.id)} className="flex min-w-0 flex-1 flex-col gap-0.5 hover:[&_.title]:underline">
                    <span className="title flex items-center gap-2 text-[12.5px] text-strong">
                      <span className="font-mono">#{d.number}</span>
                      <span className="truncate text-body">{d.commitMessage ?? (d.rollbackOfNumber ? `Rollback to #${d.rollbackOfNumber}` : "Deploy")}</span>
                      {d.live && <span className="rounded-full bg-good-s px-2 py-px text-[10px] font-semibold text-good">live</span>}
                    </span>
                    <span className="truncate text-[11px] text-faint">
                      {[
                        d.commitSha?.slice(0, 7),
                        d.type === "AUTOMATED" ? "on push" : null,
                        d.triggeredByName,
                        d.buildMethod === "RAILPACK" ? "Railpack" : d.buildMethod === "DOCKERFILE" ? "Dockerfile" : null,
                        timeAgo(d.createdAt),
                        d.startedAt && d.finishedAt ? formatDuration(Date.parse(d.finishedAt) - Date.parse(d.startedAt)) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </Link>
                  <StatusPill status={d.status} />
                  {canEdit && d.status === "SUCCESS" && !d.live && (
                    <Button variant="ghost" onClick={() => setRollingBack(d)} disabled={!!running} className="px-2 py-1 text-[11px]">
                      Roll back
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {rollingBack && <RollbackDialog service={service} target={rollingBack} onClose={() => setRollingBack(null)} onStarted={(d) => navigate(deployPath(d.id))} />}
    </div>
  );
}
