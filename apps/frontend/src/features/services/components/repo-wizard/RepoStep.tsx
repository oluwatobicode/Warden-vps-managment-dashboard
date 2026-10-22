import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Link } from "react-router";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { Select } from "../../../../components/ui/Select";
import { apiMessage } from "../../../../utils/apiMessage";
import { useGithubBranches, useGithubRepos, useGithubStatus } from "../../../github/hooks/useGithub";
import { parseRepo } from "../../hooks/useRepoServices";
import type { RepoSource } from "../../repoForm";

const PUBLIC = "public";

interface Form {
  /** An installation row id, or "public" for a pasted public repo. */
  account: string;
  repo: string;
  publicRepo: string;
  branch: string;
}

/** Step 1: which repo and branch. Repos the Warden GitHub App can see, or any public one by URL. */
export function RepoStep({ initial, busy, onNext, onCancel }: { initial: RepoSource | null; busy: boolean; onNext: (s: RepoSource) => void; onCancel: () => void }) {
  const status = useGithubStatus();
  const installations = status.data?.installations ?? [];
  const firstAccount = initial ? (initial.installationId ?? PUBLIC) : (installations[0]?.id ?? PUBLIC);
  const { control, register, handleSubmit, setValue, setError, formState: { errors } } = useForm<Form>({
    values: {
      account: firstAccount,
      repo: initial?.installationId ? initial.repo : "",
      publicRepo: initial && !initial.installationId ? initial.repo : "",
      branch: initial?.branch ?? "",
    },
  });
  const account = useWatch({ control, name: "account" });
  const repo = useWatch({ control, name: "repo" });
  const viaApp = account !== PUBLIC;
  const repos = useGithubRepos(viaApp ? account : null);
  const branches = useGithubBranches(viaApp ? account : null, viaApp && repo ? repo : null);
  const [filter, setFilter] = useState("");
  const shown = (repos.data ?? []).filter((r) => r.fullName.toLowerCase().includes(filter.trim().toLowerCase()));

  const onSubmit = (f: Form) => {
    if (viaApp) {
      if (!f.repo) return setError("repo", { message: "Pick a repo" });
      return onNext({ installationId: f.account, repo: f.repo, branch: f.branch });
    }
    const full = parseRepo(f.publicRepo);
    if (!full) return setError("publicRepo", { message: "Paste a GitHub repo, like github.com/acme/api" });
    onNext({ installationId: null, repo: full, branch: f.branch.trim() });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <Controller
        control={control}
        name="account"
        render={({ field }) => (
          <Select
            label="Where's the code?"
            {...field}
            onChange={(v) => {
              field.onChange(v);
              setValue("repo", "");
              setValue("branch", "");
            }}
            options={[
              ...installations.map((i) => ({ value: i.id, label: i.accountLogin, hint: "through the Warden GitHub App: private repos too" })),
              { value: PUBLIC, label: "A public repo", hint: "paste its address" },
            ]}
          />
        )}
      />
      {!installations.length && status.data && (
        <p className="-mt-2 m-0 text-[11.5px] text-sand">
          For private repos and deploy-on-push,{" "}
          <Link to="/settings/github" className="text-link">
            connect GitHub
          </Link>{" "}
          first.
        </p>
      )}

      {viaApp ? (
        <>
          <Input label="Find a repo" placeholder="Type to filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <Controller
            control={control}
            name="repo"
            render={({ field }) => (
              <Select
                label="Repository"
                {...field}
                onChange={(v) => {
                  field.onChange(v);
                  setValue("branch", repos.data?.find((r) => r.fullName === v)?.defaultBranch ?? "");
                }}
                error={errors.repo?.message ?? (repos.isError ? apiMessage(repos.error) : undefined)}
                disabled={repos.isPending}
                placeholder={repos.isPending ? "Loading repos…" : shown.length ? "Pick a repo" : "No repos match"}
                options={shown.slice(0, 100).map((r) => ({ value: r.fullName, label: r.fullName, hint: `${r.private ? "private" : "public"} · default branch ${r.defaultBranch}` }))}
              />
            )}
          />
          <Controller
            control={control}
            name="branch"
            render={({ field }) => (
              <Select
                label="Branch"
                {...field}
                disabled={!repo || branches.isPending}
                placeholder={!repo ? "Pick a repo first" : branches.isPending ? "Loading branches…" : "Default branch"}
                options={(branches.data ?? []).map((b) => ({ value: b, label: b }))}
              />
            )}
          />
        </>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_160px] gap-3">
          <Input label="Repository" mono placeholder="github.com/acme/api" error={errors.publicRepo?.message} {...register("publicRepo")} />
          <Input label="Branch" mono placeholder="default" {...register("branch")} />
        </div>
      )}

      <div className="-mx-[22px] -mb-5 mt-1 flex items-center justify-between gap-3 border-t border-cb px-[18px] py-3.5">
        <Button variant="ghost" onClick={onCancel} className="px-0 text-xs">
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Read the repo
        </Button>
      </div>
    </form>
  );
}
