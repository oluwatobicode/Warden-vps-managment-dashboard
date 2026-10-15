import { BOARD, FEED } from "../data";
import { useCycle } from "../hooks/useCycle";
import { Dot, Ring, SectionIntro } from "./bits";
import { TONE } from "../tone";

/**
 * A team's day replaying on a loop: events arrive one by one; when deploy
 * #418 fails its gate, the Slack toast appears and its board card flips to
 * "rolled back".
 */
export function ActivitySection() {
  const step = useCycle(7, 2200) + 1; // 1…7, like the design
  const shown = Math.min(step, FEED.length);
  const failed = shown >= 3;
  const gate418 = failed ? "rolled back" : shown >= 2 ? "gate 3 of 3" : "gate 2 of 3";

  return (
    <section id="activity" className="border-t border-[#161718]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-24 px-6 pt-32">
        <SectionIntro
          eyebrow="04 — ACTIVITY"
          title="Know who shipped what."
          sub="And when."
          body="Every deploy, rollback, variable change and cleanup is logged with who did it and when. Failures go to Slack or email so the right person hears about it first."
        />
        <div className="relative grid max-h-[640px] grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] items-start gap-4 overflow-hidden">
          <div className="l-panel relative z-[2] max-w-[440px] rounded-xl">
            <div className="flex items-center justify-between border-b border-[#23252a] px-[18px] py-3.5">
              <span className="text-sm font-[590] text-[#e5e5e6]">
                Activity <span className="font-normal text-[#62666d]">argus · production</span>
              </span>
              <span className="text-xs text-[#62666d]">Today</span>
            </div>
            <div className="flex min-h-[300px] flex-col gap-5 px-[18px] py-5" aria-live="off">
              {FEED.slice(0, shown).map((f, i) => (
                // Each new event mounts fresh, so its entrance animation plays once.
                <div key={i} className={`flex items-start gap-3 ${i === shown - 1 && step > 1 ? "l-enter" : ""}`}>
                  <span className="grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-[590]" style={{ background: f.bg, color: f.fg }}>
                    {f.init}
                  </span>
                  <div className="flex min-w-0 flex-col gap-[3px]">
                    <span className="flex items-baseline gap-2">
                      <span className="text-[13px] font-[590] text-[#e5e5e6]">{f.who}</span>
                      <span className="text-[11px] text-[#62666d]">{f.time}</span>
                    </span>
                    <span className="text-[13px] leading-normal text-[#d0d6e0]">
                      {f.hi && <span style={{ color: f.hiTone }}>{f.hi}</span>}
                      {f.rest}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {failed && (
              <div className="l-enter mx-3 mb-2 flex items-center gap-2.5 rounded-lg bg-[#08090a] px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(235,87,87,0.35)]">
                <Dot tone={TONE.crit} />
                <span className="min-w-0 text-xs text-[#d0d6e0]">
                  Posted to <span className="text-[#8b5cf6]">#deploys</span> · Adaeze and Tobi notified
                </span>
              </div>
            )}
            <div className="l-hair mx-3 mb-3 flex items-center justify-between gap-3 rounded-lg bg-[#161718] px-3.5 py-3">
              <span className="text-[13px] text-[#d0d6e0]">
                Alert <span className="rounded bg-[rgba(139,92,246,0.12)] px-[5px] py-px text-[#8b5cf6]">#deploys</span> when a gate fails
              </span>
              <span className="flex h-4 w-7 shrink-0 items-center justify-end rounded-full bg-(--accent) p-0.5">
                <span className="block size-3 rounded-full bg-white" />
              </span>
            </div>
          </div>

          <div className="l-mask-right flex gap-3 pt-14">
            {BOARD.map((col) => (
              <div key={col.label} className="flex flex-[0_0_240px] flex-col gap-2.5">
                <div className="flex items-center gap-2 px-0.5 pt-1 pb-1.5">
                  <Ring tone={col.tone} dashed={col.dashed} />
                  <span className="text-[13px] font-[510] text-[#e5e5e6]">{col.label}</span>
                  <span className="text-[13px] text-[#62666d]">{col.cards.length}</span>
                </div>
                {col.cards.map((c) => {
                  const is418 = c.id.startsWith("#418");
                  return (
                    <div key={c.id} className={`l-hair flex flex-col gap-2 rounded-lg bg-[#161718] px-3.5 py-3 ${"faded" in c && c.faded ? "opacity-55" : ""}`}>
                      <span className="l-mono text-[11px] text-[#62666d]">{c.id}</span>
                      <span className="truncate text-[13px] text-[#e5e5e6]">{c.title}</span>
                      <span className="flex flex-wrap gap-1.5">
                        <span className="l-hair flex items-center gap-[5px] rounded px-[7px] py-0.5 text-[11px] text-[#8a8f98]">
                          <Dot tone={is418 ? (failed ? TONE.crit : TONE.run) : c.tagTone} />
                          {is418 ? gate418 : c.tag}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="l-fade-bottom pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-40" />
        </div>
      </div>
    </section>
  );
}
