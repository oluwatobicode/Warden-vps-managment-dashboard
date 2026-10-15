import { COMPOSE, DEPLOY_GROUPS } from "../data";
import { Ring, SectionIntro } from "./bits";

const LINE = {
  same: { bg: "transparent", num: "#383b3f", text: "#8a8f98" },
  del: { bg: "rgba(235,87,87,0.08)", num: "#eb5757", text: "#e5e5e6" },
  add: { bg: "rgba(39,166,68,0.08)", num: "#27a644", text: "#e5e5e6" },
};

export function DeploysSection() {
  return (
    <section id="deploys" className="border-t border-[#161718]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-24 px-6 pt-32">
        <SectionIntro
          eyebrow="01 — DEPLOYS"
          title="Push to deploy."
          sub="Nothing to babysit."
          body="Connect a repo and pick a branch. Every push builds an image on your server and starts it beside the old one, so users never see a restart. Previous images stay on disk, so rolling back takes seconds."
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

          {/* the compose diff for #417 → #418 */}
          <div className="l-panel overflow-hidden rounded-xl">
            <div className="flex items-center justify-between gap-3 border-b border-[#23252a] px-5 py-3.5">
              <span className="l-mono truncate text-xs text-[#8a8f98]">argus/api/compose.yml</span>
              <span className="flex shrink-0 items-center gap-2.5">
                <span className="l-hair-strong rounded px-[7px] py-0.5 text-[11px] text-[#8a8f98]">Editable</span>
                <span className="text-xs text-[#62666d]">#417 → #418</span>
              </span>
            </div>
            <div
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              aria-label="Example compose file"
              className="l-mono cursor-text pt-3.5 pb-10 text-[12.5px] leading-[2] caret-[#e4f222] outline-none"
            >
              {COMPOSE.map(([n, text, kind], i) => {
                const c = LINE[kind];
                return (
                  <div key={i} className="flex gap-[18px] px-5 whitespace-pre" style={{ background: c.bg }}>
                    <span contentEditable={false} className="w-[18px] shrink-0 select-none" style={{ color: c.num }}>{n}</span>
                    <span style={{ color: c.text }}>{text}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="l-fade-bottom pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-40" />
        </div>
      </div>
    </section>
  );
}
