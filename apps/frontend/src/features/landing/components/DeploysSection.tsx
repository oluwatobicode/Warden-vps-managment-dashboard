import { DEPLOY_GROUPS, DEPLOY_LOG } from "../data";
import { Ring, SectionIntro } from "./bits";

export function DeploysSection() {
  return (
    <section id="deploys" className="border-t border-[#161718]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-24 px-6 pt-32">
        <SectionIntro
          eyebrow="01 — DEPLOYS"
          title="Push to deploy."
          sub="Nothing to babysit."
          body="Connect a repo and pick a branch. Every push builds an image on your server and starts it beside the old one, so users never see a restart. The last three images stay on the server, so a rollback reuses one instead of rebuilding."
        />
        <div className="relative grid max-h-[560px] grid-cols-[repeat(auto-fit,minmax(min(100%,400px),1fr))] items-start gap-4 overflow-hidden">
          {/* deploy list, grouped by state */}
          <div className="l-panel mt-10 rounded-xl pt-2 pb-6">
            {DEPLOY_GROUPS.map((g) => (
              <div key={g.label}>
                <div className="mx-2 mt-1 flex items-center gap-2.5 rounded-md bg-[#161718] px-4 py-2">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="#62666d" aria-hidden>
                    <path d="M6 9h12l-6 7z" />
                  </svg>
                  <Ring tone={g.tone} dashed={g.dashed} />
                  <span className="text-[13px] font-[510] text-[#e5e5e6]">{g.label}</span>
                  <span className="text-[13px] text-[#62666d]">{g.rows.length}</span>
                </div>
                {g.rows.map(([id, title, svc]) => (
                  <div key={id} className="flex items-center gap-3 py-2.5 pr-4 pl-9">
                    <span className="l-mono w-9 shrink-0 text-xs text-[#62666d]">{id}</span>
                    <Ring tone={g.tone} dashed={g.dashed} />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-[#e5e5e6]">{title}</span>
                    <span className="shrink-0 text-xs text-[#62666d]">{svc}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* the log of #41 (live), and a rollback to the kept #40 */}
          <div className="l-panel overflow-hidden rounded-xl">
            <div className="flex items-center justify-between gap-3 border-b border-[#23252a] px-5 py-3.5">
              <span className="l-mono truncate text-xs text-[#8a8f98]">api · deploy #41</span>
              <span className="text-xs text-[#62666d]">e91b04d · lag-01</span>
            </div>
            <div className="l-mono flex flex-col gap-0.5 px-5 pt-3.5 pb-4 text-[12px] leading-[1.9]">
              {DEPLOY_LOG.map(([t, msg, tone], i) => (
                <div key={i} className="flex gap-4 whitespace-pre">
                  <span className="shrink-0 text-[#383b3f]">{t}</span>
                  <span className="truncate" style={{ color: tone }}>{msg}</span>
                </div>
              ))}
            </div>
            <div className="mx-3 mb-3 flex flex-col gap-2 rounded-lg bg-[#161718] px-3.5 py-3 shadow-[inset_0_0_0_1px_#23252a]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-[#e5e5e6]">Roll back to #40</span>
                <span className="l-hair-strong rounded px-2 py-0.5 text-[11px] text-[#d0d6e0]">Roll back</span>
              </div>
              <span className="text-xs leading-normal text-[#8a8f98]">
                Reuses the image kept from #40, no rebuild. Database changes and variables aren’t rolled back.
              </span>
            </div>
          </div>
          <div className="l-fade-bottom pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-40" />
        </div>
      </div>
    </section>
  );
}
