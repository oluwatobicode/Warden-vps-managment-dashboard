import { FUNNEL_STEP_LABEL, type PlatformOverview } from "shared-types";
import { fmtInt } from "../format";

/** Horizontal bars, each as a share of all orgs, with the drop from the step before. */
export function Funnel({ steps }: { steps: PlatformOverview["funnel"]["steps"] }) {
  const total = steps[0]?.orgs ?? 0;
  return (
    <div className="mt-4 flex flex-col gap-2.5">
      {steps.map((s, i) => {
        const share = total ? s.orgs / total : 0;
        const prev = i > 0 ? steps[i - 1].orgs : null;
        const drop = prev !== null && prev > 0 && s.orgs < prev ? Math.round(((prev - s.orgs) / prev) * 100) : null;
        return (
          <div key={s.step} className="grid grid-cols-[170px_1fr_110px] items-center gap-3 max-sm:grid-cols-[1fr_auto]">
            <span className="truncate text-xs text-muted-deep">{FUNNEL_STEP_LABEL[s.step]}</span>
            <span className="h-[18px] overflow-hidden rounded-[4px] bg-raised max-sm:col-span-2 max-sm:row-start-2">
              <span className="block h-full rounded-[4px] bg-brand" style={{ width: `${Math.max(share * 100, s.orgs ? 1.5 : 0)}%` }} />
            </span>
            <span className="text-right font-mono text-xs text-body">
              {fmtInt(s.orgs)} <span className="text-sand">· {Math.round(share * 100)}%</span>
              {drop !== null && <span className="ml-1.5 text-serious">−{drop}%</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
