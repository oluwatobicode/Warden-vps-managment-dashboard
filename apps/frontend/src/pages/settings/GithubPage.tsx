import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import toast from "react-hot-toast";
import { HugeiconsIcon } from "@hugeicons/react";
import { GithubIcon } from "@hugeicons/core-free-icons";
import { Button } from "../../components/ui/Button";
import { Card, SectionHeader } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { useConnectGithub, useDisconnectGithub, useGithubStatus, type GithubStatus } from "../../features/github/hooks/useGithub";
import { apiMessage } from "../../utils/apiMessage";
import { formatDate } from "../../utils/formatDate";
import { atLeast } from "../../utils/roles";

/**
 * Settings → GitHub: connect GitHub accounts through the Warden GitHub App,
 * so services can deploy private repos and deploy on every push. DevOps and
 * Admin connect; everyone sees what's connected.
 */
export default function GithubPage() {
  const { user } = useAuth();
  const status = useGithubStatus();
  const connect = useConnectGithub();
  const disconnect = useDisconnectGithub();
  const [params, setParams] = useSearchParams();
  const [removing, setRemoving] = useState<GithubStatus["installations"][number] | null>(null);
  const canEdit = atLeast(user?.role, "DEV_OPS");

  // Back from GitHub: say how it went, once.
  useEffect(() => {
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) toast.success(`GitHub account ${connected} connected`);
    if (error) toast.error(error);
    if (connected || error) setParams({}, { replace: true });
  }, [params, setParams]);

  const onConnect = () => connect.mutate(undefined, { onError: (e) => toast.error(apiMessage(e)) });
  const onDisconnect = () =>
    removing &&
    disconnect.mutate(removing.id, {
      onSuccess: () => {
        toast.success(`${removing.accountLogin} disconnected`);
        setRemoving(null);
      },
      onError: (e) => {
        toast.error(apiMessage(e));
        setRemoving(null);
      },
    });

  return (
    <>
      <SectionHeader
        title="GitHub"
        sub="Connect GitHub to deploy private repos and deploy on every push. Public repos also work without it, by pasting their URL."
        action={
          canEdit &&
          status.data?.configured && (
            <Button onClick={onConnect} loading={connect.isPending}>
              <HugeiconsIcon icon={GithubIcon} size={14} strokeWidth={1.6} />
              Connect GitHub
            </Button>
          )
        }
      />
      <div className="mt-[22px] flex max-w-[720px] flex-col gap-3">
        {status.isPending && <Skeleton className="h-24 rounded-[18px]" />}
        {status.isError && <p className="text-sm text-crit">{apiMessage(status.error)}</p>}
        {status.data && !status.data.configured && (
          <Card title="The Warden GitHub App isn't set up yet" sub="Whoever runs this Warden creates one GitHub App and puts its keys in the api and worker .env (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_APP_WEBHOOK_SECRET, GITHUB_APP_SLUG). See docs/PHASE-2-DEPLOY-PLAN.md." />
        )}
        {status.data?.configured && status.data.installations.length === 0 && (
          <EmptyState title="No GitHub account connected">
            {canEdit ? "Press Connect GitHub, pick an account and the repos Warden may read, and you'll come back here." : "A DevOps or Admin can connect one."}
          </EmptyState>
        )}
        {status.data?.installations.map((i) => (
          <Card
            key={i.id}
            title={i.accountLogin}
            sub={`${i.accountType === "Organization" ? "GitHub organization" : "GitHub user"} · connected ${formatDate(i.createdAt)} · ${i.serviceCount} ${i.serviceCount === 1 ? "service" : "services"}`}
            action={
              <div className="flex gap-2">
                {status.data?.appSlug && (
                  <a
                    href={`https://github.com/settings/installations`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg px-2.5 py-1.5 text-[11.5px] text-sand hover:text-strong"
                  >
                    Choose repos on GitHub
                  </a>
                )}
                {canEdit && (
                  <Button variant="ghost" onClick={() => setRemoving(i)} className="px-2.5 py-1.5 text-[11.5px]">
                    Disconnect
                  </Button>
                )}
              </div>
            }
          />
        ))}
      </div>
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={onDisconnect}
        loading={disconnect.isPending}
        title={`Disconnect ${removing?.accountLogin ?? ""}?`}
        body="Its services keep their repo address, but private repos can't be deployed and pushes stop deploying until it's connected again. To remove Warden's access completely, also uninstall the app on GitHub."
        cta="Disconnect"
      />
    </>
  );
}
