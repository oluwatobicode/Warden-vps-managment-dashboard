import { CHANGELOG } from "../data";
import { ArrowIcon } from "./bits";

const PILLS = [
  { text: "v0.9.4", tone: "#e4f222", className: "top-2.5 left-0 -rotate-6" },
  { text: "+ preview envs", tone: "#27a644", className: "top-0 right-1.5 rotate-[5deg]" },
  { text: "fix: ssh keepalive", tone: "#02b8cc", className: "right-7 bottom-2 -rotate-3" },
];

export function ChangelogSection() {
  return (
    <section id="changelog" className="mx-auto flex max-w-[1200px] flex-col gap-20 px-6 pt-40">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="relative px-6 py-11 sm:px-[120px]">
          <div className="pointer-events-none absolute -inset-10 bg-[radial-gradient(ellipse_at_center,rgba(228,242,34,0.10),rgba(2,184,204,0.05)_42%,transparent_70%)]" />
          {PILLS.map((p) => (
            <span key={p.text} className={`l-hair l-mono absolute hidden items-center gap-1.5 rounded-full bg-[#0f1011] px-2.5 py-1 text-xs text-[#8a8f98] sm:flex ${p.className}`}>
              <span className="block size-1.5 rounded-full" style={{ background: p.tone }} />
              {p.text}
            </span>
          ))}
          <span className="l-mono absolute bottom-0.5 left-9 hidden text-[13px] text-[#383b3f] sm:block">~/warden $ git log --oneline</span>
          <h2 className="relative m-0 text-[clamp(48px,7vw,92px)] leading-none font-extrabold tracking-[-0.04em] text-white italic [text-shadow:0_0_40px_rgba(228,242,34,0.18)]">
            Always shipping
          </h2>
        </div>
        <p className="m-0 max-w-[460px] text-[17px] leading-[1.6] text-balance text-[#8a8f98]">
          What changed in Warden recently. Every release is tagged on GitHub with full notes.
        </p>
      </div>
      <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-y-12 p-0">
        {CHANGELOG.map((c) => (
          <li key={c.title} className="flex min-w-0 flex-col gap-14">
            <div className="flex items-center gap-4">
              <span
                className="block size-2.5 shrink-0 rounded-full"
                style={c.latest ? { background: "#e4f222", boxShadow: "0 0 0 5px rgba(228,242,34,0.12)" } : { background: "#383b3f", boxShadow: "0 0 0 5px #161718" }}
              />
              <span className="block h-px flex-1 bg-[#161718]" />
            </div>
            <div className="flex flex-col gap-2.5 pr-6">
              <span className="text-[15px] font-[510] text-[#e5e5e6]">{c.title}</span>
              <span className="text-[15px] leading-[1.6] text-[#8a8f98]">{c.text}</span>
              <span className="l-mono mt-3.5 text-xs tracking-[0.04em] text-[#62666d]">{c.date}</span>
            </div>
          </li>
        ))}
      </ol>
      <a href="#changelog" className="flex w-max items-center gap-1.5 text-[15px] text-[#8a8f98] hover:text-[#e5e5e6]">
        View all <ArrowIcon />
      </a>
    </section>
  );
}
