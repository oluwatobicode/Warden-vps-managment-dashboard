import { useState, type CSSProperties } from "react";
import { HERO_TAGS, SOURCES } from "../data";
import { useCycle } from "../hooks/useCycle";
import { ArrowIcon, BoxIcon, BranchIcon, ServerIcon, ShieldIcon, SparkleIcon } from "./bits";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;
const vars = (v: Record<string, string>) => v as CSSProperties;

// The squares in the backdrop grid that light up one after another. The grid
// starts at the screen's left edge, so these stay on multiples of 100 (−1)
// and spread across wide screens too; any past the edge are just clipped.
const CELLS = [
  [99, 299],
  [499, 0],
  [1099, 99],
  [299, 599],
  [1299, 499],
  [1599, 199],
  [1799, 599],
];
const FLOATS = [
  { icon: BranchIcon, left: "50%", top: 50 },
  { icon: ServerIcon, left: "20%", top: 420 },
  { icon: "double-check", left: "78%", top: 250 },
  { icon: ShieldIcon, left: "88%", top: 560 },
  { icon: BoxIcon, left: "8%", top: 650 },
] as const;

export function Hero() {
  const tag = HERO_TAGS[useCycle(HERO_TAGS.length, 2600)];
  const [source, setSource] = useState<(typeof SOURCES)[number]["id"]>("github");
  const placeholder = SOURCES.find((s) => s.id === source)!.placeholder;

  return (
    // The grid pattern runs edge to edge; the content stays centred on top of it.
    <section id="top" className="relative mt-7 overflow-hidden border-b border-[#161718]">
      <div className="l-grid pointer-events-none absolute inset-0" />
      {CELLS.map(([left, top], i) => (
        <span
          key={i}
          className="l-cell l-hair pointer-events-none absolute block size-[99px] bg-[rgba(255,255,255,0.025)]"
          style={{ left, top, ...vars({ "--delay": `${i * 1500}ms` }) }}
        />
      ))}
      <div className="l-dots l-dots-left l-breathe pointer-events-none absolute top-[58%] -left-1 h-[300px] w-[150px]" />
      <div className="l-dots l-dots-right l-breathe pointer-events-none absolute top-[58%] -right-1 h-[300px] w-[150px]" style={vars({ "--delay": "2100ms" })} />
      <div className="relative mx-auto max-w-[1248px] px-6">
        <div className="relative px-6 pt-[200px] pb-[72px]">
          <span className="l-mono absolute top-5 left-5 text-xs tracking-[0.06em] text-[#62666d]">[ 4 SERVERS ]</span>
          <span className="l-mono absolute top-5 right-5 text-xs tracking-[0.06em] text-[#62666d]">[ {tag} ]</span>
          <span className="l-mono absolute bottom-5 left-5 text-xs tracking-[0.06em] text-[#62666d]">[ COMPOSE.YML ]</span>
          <span className="l-mono absolute right-5 bottom-5 text-xs tracking-[0.06em] text-[#62666d]">[ 200 OK ]</span>

          {["16.6%", "83.4%"].map((left, i) => (
            <span
              key={left}
              className="absolute top-[150px] grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center border border-[#23252a] bg-[#0f1011]"
              style={{ left }}
            >
              <SparkleIcon className="l-spark text-[#8a8f98]" style={vars({ "--delay": `${i * 1600}ms` })} />
            </span>
          ))}
          {FLOATS.map((f, i) => {
            const style = { left: f.left, top: f.top, ...vars({ "--dur": `${3800 + i * 600}ms`, "--delay": `${i * 400}ms` }) };
            const cls = "l-float absolute -translate-x-1/2 -translate-y-1/2 text-[#383b3f]";
            if (f.icon === "double-check") {
              return (
                <svg key={i} className={cls} style={style} width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m4 13 4 4L20 6" />
                  <path d="m10 17 1 1 9-10" opacity=".5" />
                </svg>
              );
            }
            const Icon = f.icon;
            return <Icon key={i} size={30} strokeWidth={1.4} className={cls} style={style} />;
          })}

          <div className="relative flex flex-col items-center gap-8 text-center">
            <a
              href="#changelog"
              style={rise(0)}
              className="l-rise flex w-max shrink-0 items-center gap-3 border border-[#23252a] bg-[#0f1011] py-[5px] pr-[5px] pl-3.5 text-sm whitespace-nowrap text-[#e5e5e6] hover:border-[#383b3f] hover:text-white"
            >
              Free and open source
              <span className="grid size-[22px] place-items-center bg-[#e5e5e6] text-[#08090a]">
                <ArrowIcon size={12} strokeWidth={2.4} />
              </span>
            </a>
            <h1 style={rise(1)} className="l-rise m-0 text-[clamp(44px,7vw,88px)] leading-[1.02] font-bold tracking-[-0.035em] text-balance text-white">
              The PaaS experience.
              <br />
              <span className="text-[#8a8f98]">On servers you own.</span>
            </h1>
            <p style={rise(2)} className="l-rise m-0 max-w-[700px] text-[clamp(17px,1.7vw,21px)] leading-[1.6] tracking-[-0.24px] text-pretty text-[#8a8f98]">
              Warden turns any VPS into a deploy platform with push-to-deploy, health-checked releases and one-click rollback.{" "}
              <span className="bg-[#161718] px-2 py-0.5 text-white [box-decoration-break:clone]">Keep the speed, drop the PaaS bill.</span>
            </p>
            <div style={rise(3)} className="l-rise flex flex-wrap justify-center gap-4">
              <a href="#install" className="flex items-center gap-2.5 rounded-[2px] bg-[#e5e5e6] px-[26px] py-3.5 text-base font-[510] text-[#08090a] hover:bg-white">
                Install Warden <ArrowIcon size={16} strokeWidth={2.2} />
              </a>
              <a href="#docs" className="flex items-center gap-3 rounded-[2px] border border-[#23252a] bg-[#0f1011] py-[9px] pr-5 pl-2.5 text-base font-[510] text-[#e5e5e6] hover:border-[#383b3f] hover:text-white">
                <span className="flex">
                  {[BranchIcon, BoxIcon, ServerIcon].map((Icon, i) => (
                    <span key={i} className="grid size-[26px] place-items-center border border-[#23252a] bg-[#161718] text-[#d0d6e0]">
                      <Icon size={14} />
                    </span>
                  ))}
                </span>
                Connect a repo
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </a>
            </div>

            <div style={rise(4)} className="l-rise mt-2 w-full max-w-[820px] border border-[#23252a] bg-[#0f1011] text-left">
              <label className="flex items-center gap-3.5 border-b border-[#23252a] px-[22px] py-5">
                <BranchIcon className="text-[#8a8f98]" />
                <span className="sr-only">Repository or file</span>
                <input
                  type="text"
                  placeholder={placeholder}
                  className="min-w-0 flex-1 border-none bg-transparent text-lg text-[#e5e5e6] outline-none placeholder:text-[#62666d]"
                />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3">
                <div role="radiogroup" aria-label="Source" className="flex flex-wrap">
                  {SOURCES.map((s) => {
                    const on = s.id === source;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setSource(s.id)}
                        className={`flex cursor-pointer items-center gap-2 border px-3.5 py-2 text-[15px] ${on ? "border-[#383b3f] bg-[#161718] text-white" : "border-transparent bg-transparent text-[#8a8f98] hover:text-[#e5e5e6]"}`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
                <a href="#install" aria-label="Continue" className="grid h-11 w-14 place-items-center rounded-[2px] bg-[#e5e5e6] text-[#08090a] hover:bg-white">
                  <ArrowIcon size={18} strokeWidth={2.2} />
                </a>
              </div>
            </div>
            <p style={rise(5)} className="l-rise -mt-2 mb-0 max-w-[440px] text-[15px] leading-[1.6] text-balance text-[#62666d]">
              Warden reads your Dockerfile or compose file and suggests health checks. Nothing deploys until you confirm.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
