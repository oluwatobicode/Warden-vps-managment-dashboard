import { WHY } from "../data";
import { CheckIcon, CrossIcon, Eyebrow } from "./bits";
import { TONE } from "../tone";

function Column({ title, meta, metaTone, items, good }: { title: string; meta: string; metaTone: string; items: string[]; good: boolean }) {
  return (
    <div className={`rounded-xl px-7 pt-7 pb-3.5 ${good ? "l-panel" : "l-hair bg-[#08090a]"}`}>
      <div className="flex flex-col items-start gap-1.5 pb-[18px]">
        <span className={`text-xl font-semibold whitespace-nowrap ${good ? "text-white" : "text-[#8a8f98]"}`}>{title}</span>
        <span className="l-mono text-xs whitespace-nowrap" style={{ color: metaTone }}>{meta}</span>
      </div>
      {items.map((t) => (
        <div key={t} className="flex items-start gap-3.5 border-t border-[#161718] py-3.5">
          <span className="mt-px grid size-[22px] shrink-0 place-items-center" style={{ color: good ? TONE.good : TONE.crit }}>
            {good ? <CheckIcon /> : <CrossIcon />}
          </span>
          <span className={`text-[15px] leading-normal ${good ? "text-[#e5e5e6]" : "text-[#8a8f98]"}`}>{t}</span>
        </div>
      ))}
    </div>
  );
}

export function WhySection() {
  return (
    <section id="why" className="mx-auto flex max-w-[1200px] flex-col gap-20 px-6 pt-[176px] pb-40">
      <div className="flex flex-col gap-5">
        <Eyebrow>WHY WARDEN</Eyebrow>
        <h2 className="m-0 max-w-[1100px] text-[clamp(32px,4.2vw,48px)] leading-[1.08] font-semibold tracking-[-1.056px] text-pretty text-white">
          A $20 VPS shouldn’t cost you a weekend of bash scripts.{" "}
          <span className="text-[#8a8f98]">
            Teams end up choosing between a platform that gets expensive fast and a server they’re afraid to touch. Warden gives you the first experience on the second.
          </span>
        </h2>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,400px),1fr))] gap-4">
        <Column title="Deploying by hand" meta="~ 40 min, some downtime" metaTone="#62666d" items={WHY.before} good={false} />
        <Column title="Deploying with Warden" meta="git push · zero downtime" metaTone={TONE.good} items={WHY.after} good />
      </div>
    </section>
  );
}
