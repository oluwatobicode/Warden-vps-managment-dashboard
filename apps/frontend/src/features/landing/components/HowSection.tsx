import type { CSSProperties, ReactNode } from "react";
import { STEPS } from "../data";
import { BoxIcon, ShieldIcon, StarBurstIcon } from "./bits";

const STEP_ICON: Record<(typeof STEPS)[number]["icon"], ReactNode> = {
  terminal: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 17V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11" />
      <path d="M2 20h20" />
      <path d="m8 10 2 2-2 2M12 14h4" />
    </svg>
  ),
  box: <BoxIcon size={28} />,
  shield: <ShieldIcon size={28} strokeWidth={1.8} />,
  globe: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
    </svg>
  ),
};

export function HowSection() {
  return (
    <section id="how" className="mx-auto flex max-w-[1200px] flex-col items-center gap-[104px] px-6 pb-[176px]">
      <div className="relative px-16 py-6">
        <div className="pointer-events-none absolute -inset-x-20 -inset-y-[60px] bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.14),rgba(99,102,241,0.06)_40%,transparent_70%)]" />
        <StarBurstIcon size={56} className="l-float absolute -top-1.5 right-0 text-[#e4f222]" />
        <StarBurstIcon size={22} className="l-float absolute top-[18px] left-[22px] text-[#02b8cc]" style={{ "--delay": "400ms" } as CSSProperties} />
        <StarBurstIcon size={44} className="l-float absolute bottom-1 left-0 text-[#8b5cf6]" style={{ "--delay": "800ms" } as CSSProperties} />
        <h2 className="relative m-0 text-[clamp(48px,7vw,92px)] leading-none font-extrabold tracking-[-0.04em] text-white italic [text-shadow:0_0_40px_rgba(255,255,255,0.25)]">
          It just ships
        </h2>
      </div>
      <p className="-mt-16 mb-0 max-w-[480px] text-center text-[17px] leading-[1.6] text-balance text-[#8a8f98]">
        From <span className="l-mono text-[15px] text-[#e5e5e6]">git push</span> to live traffic in four steps, on a server you control.
      </p>
      <div className="relative grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-y-14">
        {/* the line joining the four steps, with a dot travelling along it */}
        <div className="absolute top-[78px] right-[12.5%] left-[12.5%] hidden h-px bg-[linear-gradient(90deg,transparent,#383b3f_8%,#383b3f_92%,transparent)] lg:block">
          <span className="l-flow absolute -top-[3px] -ml-[3px] block size-[7px] rounded-full bg-white shadow-[0_0_14px_3px_rgba(255,255,255,0.55)]" />
        </div>
        {STEPS.map((s) => (
          <div key={s.name} className="relative flex flex-col items-center gap-7 text-center">
            <span
              className="grid size-16 place-items-center rounded-2xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),0_0_0_1px_rgba(0,0,0,0.6)]"
              style={{ background: s.bg, color: s.tone }}
            >
              {STEP_ICON[s.icon]}
            </span>
            <div className="flex flex-col gap-2.5 px-3">
              <span className="text-xl font-semibold tracking-[-0.3px] text-white">{s.name}</span>
              <span className="text-[15px] leading-[1.55] text-balance text-[#8a8f98]">
                {s.text}
                <br />
                <span className="l-mono text-[13px]" style={{ color: s.tone }}>{s.code}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
