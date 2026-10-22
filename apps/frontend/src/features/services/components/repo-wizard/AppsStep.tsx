import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import type { RepoInspection } from "shared-types";
import { Button } from "../../../../components/ui/Button";
import { appKey } from "../../repoForm";

/** Step 2: what Warden found in the repo. Tick the apps that become services. */
export function AppsStep({
  inspection,
  picked,
  onToggle,
  onBack,
  onNext,
}: {
  inspection: RepoInspection;
  picked: Set<string>;
  onToggle: (key: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { apps } = inspection;
  return (
    <div className="flex flex-col gap-3.5">
      <p className="m-0 text-[12.5px] text-muted-deep">
        <span className="font-mono text-body">{inspection.fullName}</span> @ <span className="font-mono text-body">{inspection.branch}</span>
        {inspection.monorepo ? ` · a monorepo with ${apps.length} ${apps.length === 1 ? "app" : "apps"}` : ""}
      </p>
      {inspection.truncated && <p className="m-0 text-[11.5px] text-warn">This repo is very big; GitHub only listed part of it, so an app may be missing.</p>}

      {apps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-fieldb px-5 py-8 text-center">
          <p className="m-0 text-[13px] font-semibold text-strong">Nothing to deploy here</p>
          <p className="mx-auto mt-2 mb-0 max-w-sm text-[12px] text-muted-warm">
            Warden found no app in this repo: no package.json, Dockerfile, or Python/Go/Ruby/PHP files. Check it's the right repo and branch.
          </p>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {apps.map((a) => {
            const key = appKey(a);
            const on = picked.has(key);
            return (
              <li key={key}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => onToggle(key)}
                  className={`flex w-full cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-left ${on ? "border-focus bg-raised" : "border-cb hover:border-fieldb"}`}
                >
                  <span className={`mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px] ${on ? "border-good bg-good text-[#0b0c0e]" : "border-fieldb"}`}>
                    {on && <HugeiconsIcon icon={Tick02Icon} size={12} strokeWidth={3} />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[13px] text-strong">{a.name}</span>
                      <span className="rounded-full bg-chip px-2 py-px text-[10.5px] text-muted-deep">{a.framework}</span>
                      {a.website && <span className="rounded-full bg-brand-s px-2 py-px text-[10.5px] text-brand">website</span>}
                      {a.type === "WORKER" && <span className="rounded-full bg-chip px-2 py-px text-[10.5px] text-muted-deep">worker</span>}
                    </span>
                    <span className="font-mono text-[11px] text-faint">{a.path || "repo root"}</span>
                    {a.notes[0] && <span className="text-[11.5px] text-sand">{a.notes[0]}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="-mx-[22px] -mb-5 mt-1 flex items-center justify-between gap-3 border-t border-cb px-[18px] py-3.5">
        <Button variant="ghost" onClick={onBack} className="px-0 text-xs">
          ← Back
        </Button>
        <Button onClick={onNext} disabled={!picked.size}>
          {picked.size > 1 ? `Continue with ${picked.size} apps` : "Continue"}
        </Button>
      </div>
    </div>
  );
}
