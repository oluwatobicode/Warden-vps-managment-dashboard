import { useState } from "react";
import toast from "react-hot-toast";
import type { CreateFromRepoInput, CreateFromRepoResult, Environment, RepoInspection } from "shared-types";
import { apiMessage } from "../../../../utils/apiMessage";
import { useServers } from "../../../servers/hooks/useServers";
import { useCreateFromRepo, useInspectRepo } from "../../hooks/useRepoServices";
import { appKey, appToForm, type AppForm, type RepoSource } from "../../repoForm";
import { AppsStep } from "./AppsStep";
import { RepoStep } from "./RepoStep";
import { ReviewStep } from "./ReviewStep";

type Step = "repo" | "apps" | "review";

/**
 * Add service → From GitHub, in 3 steps: pick the repo, tick the apps Warden
 * found in it, check the prefilled settings and deploy.
 */
export function RepoWizard({ env, onCancel, onDone }: { env: Environment; onCancel: () => void; onDone: (r: CreateFromRepoResult, deployed: boolean) => void }) {
  const inspect = useInspectRepo();
  const create = useCreateFromRepo();
  const servers = useServers();
  const [step, setStep] = useState<Step>("repo");
  const [source, setSource] = useState<RepoSource | null>(null);
  const [inspection, setInspection] = useState<RepoInspection | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [forms, setForms] = useState<AppForm[]>([]);

  // The environment's default server; with no default but exactly one deploy server, that one.
  const deploy = (servers.data ?? []).filter((s) => s.serverType === "DEPLOY");
  const defaultServer = env.defaultServerId ?? (deploy.length === 1 ? deploy[0].id : "");

  const readRepo = (s: RepoSource) =>
    inspect.mutate(
      { installationId: s.installationId ?? undefined, repo: s.repo, branch: s.branch || undefined },
      {
        onSuccess: (r) => {
          setSource({ ...s, branch: r.branch });
          setInspection(r);
          setPicked(new Set(r.apps.map(appKey)));
          setStep("apps");
        },
        onError: (e) => toast.error(apiMessage(e)),
      },
    );

  const toReview = () => {
    if (!inspection) return;
    setForms(inspection.apps.filter((a) => picked.has(appKey(a))).map((a) => appToForm(a, defaultServer)));
    setStep("review");
  };

  const submit = (input: CreateFromRepoInput) =>
    create.mutate(input, {
      onSuccess: (r) => onDone(r, input.deploy),
      onError: (e) => toast.error(apiMessage(e)),
    });

  if (step === "apps" && inspection) {
    return (
      <AppsStep
        inspection={inspection}
        picked={picked}
        onToggle={(k) =>
          setPicked((prev) => {
            const next = new Set(prev);
            if (next.has(k)) next.delete(k);
            else next.add(k);
            return next;
          })
        }
        onBack={() => setStep("repo")}
        onNext={toReview}
      />
    );
  }
  if (step === "review" && source) {
    return <ReviewStep environmentId={env.id} source={source} initial={forms} busy={create.isPending} onBack={() => setStep("apps")} onSubmit={submit} />;
  }
  return <RepoStep initial={source} busy={inspect.isPending} onNext={readRepo} onCancel={onCancel} />;
}
