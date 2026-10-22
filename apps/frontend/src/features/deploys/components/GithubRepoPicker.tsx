import { useState } from "react";
import { Link } from "react-router";
import toast from "react-hot-toast";
import type { DeploySettings, Service } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { apiMessage } from "../../../utils/apiMessage";
import { useGithubRepos, useGithubStatus } from "../../github/hooks/useGithub";
import { useUpdateDeploySettings } from "../hooks/useDeploys";

/**
 * Pick the repo through the Warden GitHub App: private repos work, and pushes
 * can deploy by themselves. Public repos can also just be pasted as a URL in
 * "Source & runtime".
 */
export function GithubRepoPicker({ service, settings, canEdit }: { service: Service; settings: DeploySettings; canEdit: boolean }) {
  const status = useGithubStatus();
  const update = useUpdateDeploySettings(service.id);
  const installations = status.data?.installations ?? [];
  const [installationId, setInstallationId] = useState<string>(settings.githubInstallationId ?? "");
  const current = installationId || installations[0]?.id || "";
  const repos = useGithubRepos(current || null);
  const [repoId, setRepoId] = useState<string>(settings.githubRepoId ? String(settings.githubRepoId) : "");

  if (status.isPending) return null;
  if (!status.data?.configured) {
    return <p className="mt-3.5 text-[12px] text-sand">Public repos work by URL in "Source & runtime". For private repos and deploy-on-push, this Warden needs its GitHub App set up first.</p>;
  }
  if (!installations.length) {
    return (
      <p className="mt-3.5 text-[12px] text-sand">
        No GitHub account is connected yet.{" "}
        <Link to="/settings/github" className="text-link">
          Connect GitHub
        </Link>{" "}
        (DevOps or Admin), then pick the repo here.
      </p>
    );
  }

  const linked = settings.githubRepoId != null;
  const onSave = () =>
    update.mutate(
      { githubInstallationId: current, githubRepoId: Number(repoId) },
      {
        onSuccess: () => toast.success("Repo connected. Pushes to its branch now deploy (if auto-deploy is on)"),
        onError: (e) => toast.error(apiMessage(e)),
      },
    );
  const onUnlink = () =>
    update.mutate(
      { githubInstallationId: null, githubRepoId: null },
      { onSuccess: () => toast.success("Disconnected from the GitHub App"), onError: (e) => toast.error(apiMessage(e)) },
    );

  return (
    <div className="mt-3.5 flex flex-col gap-3.5">
      {linked && <p className="m-0 text-[12px] text-good">Connected through the GitHub App: {service.githubRepoUrl?.replace("https://github.com/", "")}</p>}
      {installations.length > 1 && (
        <Select
          label="GitHub account"
          value={current}
          onChange={(v) => {
            setInstallationId(v);
            setRepoId("");
          }}
          disabled={!canEdit}
          options={installations.map((i) => ({ value: i.id, label: i.accountLogin, hint: i.accountType }))}
        />
      )}
      <Select
        label="Repository"
        value={repoId}
        onChange={setRepoId}
        disabled={!canEdit || repos.isPending}
        placeholder={repos.isPending ? "Loading repos…" : repos.isError ? "Couldn't load repos" : "Pick a repo"}
        options={(repos.data ?? []).map((r) => ({ value: String(r.id), label: r.fullName, hint: `${r.private ? "private" : "public"} · default branch ${r.defaultBranch}` }))}
      />
      {repos.isError && <p className="-mt-2 m-0 text-[11.5px] text-crit">{apiMessage(repos.error)}</p>}
      {canEdit && (
        <div className="flex gap-2">
          <Button onClick={onSave} disabled={!repoId || (linked && Number(repoId) === settings.githubRepoId)} loading={update.isPending} className="self-start">
            Use this repo
          </Button>
          {linked && (
            <Button variant="ghost" onClick={onUnlink} disabled={update.isPending} className="text-xs">
              Disconnect
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
