import type { ReactNode } from "react";
import { GITHUB_URL, OPEN_SOURCE } from "../data";
import { ServerIcon } from "./bits";

const svg = (children: ReactNode) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
const ICON: Record<(typeof OPEN_SOURCE)[number]["icon"], ReactNode> = {
  lock: svg(
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>,
  ),
  people: svg(
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M21 20c0-2.8-1.9-5.1-4.5-5.8" />
    </>,
  ),
  server: <ServerIcon size={20} />,
  terminal: svg(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m7 9 3 3-3 3M13 15h4" />
    </>,
  ),
};

export function OpenSourceSection() {
  return (
    <section id="github" className="mx-auto max-w-[1200px] px-6 pt-40">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] items-center gap-x-[72px] gap-y-14">
        <div className="flex flex-col gap-7">
          <h2 className="m-0 text-[clamp(44px,5.6vw,72px)] leading-none font-bold tracking-[-0.035em] text-white">Open source</h2>
          <p className="m-0 max-w-[540px] text-[clamp(17px,1.6vw,20px)] leading-[1.6] text-pretty text-[#8a8f98]">
            Warden’s code is public on GitHub. Read the code that touches your servers, report what breaks, or run the whole control plane on your own server instead of using a hosted one.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 rounded-full bg-white px-6 py-[13px] text-base font-[590] text-[#08090a] hover:bg-[#e5e5e6]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" />
              </svg>
              Star on GitHub
            </a>
            <a href={`${GITHUB_URL}/issues`} target="_blank" rel="noreferrer" className="l-hair-strong flex items-center gap-2.5 rounded-full bg-[#0f1011] px-6 py-[13px] text-base font-[590] text-[#e5e5e6] hover:bg-[#161718] hover:text-white">
              {svg(<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />)}
              Open an issue
            </a>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-9 gap-y-10 rounded-[22px] bg-[#0f1011] p-11 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_1px_0_0_rgba(255,255,255,0.04),0_0_0_1px_rgba(0,0,0,0.6)] max-sm:grid-cols-1 max-sm:p-7">
          {OPEN_SOURCE.map((f) => (
            <div key={f.title} className="flex flex-col gap-3.5">
              <span className="grid size-11 place-items-center rounded-[10px]" style={{ background: f.bg, color: f.tone }}>
                {ICON[f.icon]}
              </span>
              <span className="text-[19px] font-semibold tracking-[-0.3px] text-white">{f.title}</span>
              <span className="text-[15px] leading-[1.55] text-pretty text-[#8a8f98]">{f.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
