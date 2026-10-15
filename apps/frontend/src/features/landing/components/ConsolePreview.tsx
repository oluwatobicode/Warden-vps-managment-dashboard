import type { CSSProperties } from "react";
import { CONSOLE } from "../data";
import { CheckIcon, ClockIcon, Dot, ShieldIcon, WaitIcon } from "./bits";
import { TONE } from "../tone";

const GATE_ICON = { ok: CheckIcon, run: ClockIcon, wait: WaitIcon };

/**
 * The console screenshot under the hero, drawn as live markup: a deploy of
 * argus-api sitting at its health gates with the log streaming. Decorative,
 * so it's hidden from screen readers (the alt text says what it shows).
 */
export function ConsolePreview() {
  return (
    <section className="mx-auto mt-24 max-w-[1248px] px-6">
      <div
        style={{ "--i": 6 } as CSSProperties}
        className="l-rise relative rounded-[22px] bg-[#0f1011] p-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),inset_0_1px_0_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(0,0,0,0.6),0_24px_80px_0_rgba(8,9,10,0.6)]"
      >
        <div className="absolute -top-px right-[10%] left-[10%] block h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)]" />
        <div
          role="img"
          aria-label="Warden console showing a live deploy of argus-api with health gates and a streaming log"
          className="grid min-h-[560px] grid-cols-1 overflow-hidden rounded-[14px] border border-[#1b1c1e] bg-[#08090a] md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)_260px]"
        >
          {/* project sidebar */}
          <aside aria-hidden className="hidden flex-col gap-4 border-r border-[#161718] p-4 md:flex">
            <div className="flex items-center gap-2.5 text-white">
              <ShieldIcon size={16} className="text-[#e5e5e6]" />
              <span className="text-sm font-semibold">argus</span>
              <span className="ml-auto rounded bg-[#161718] px-1.5 py-px text-[10px] text-[#8a8f98]">production</span>
            </div>
            <span className="l-mono mt-2 text-[10px] tracking-[0.08em] text-[#62666d]">SERVICES</span>
            <div className="flex flex-col gap-0.5">
              {CONSOLE.services.map((s) => (
                <div key={s.name} className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 ${s.on ? "bg-[#161718]" : ""}`}>
                  <Dot tone={s.tone} />
                  <span className="l-mono truncate text-xs text-[#d0d6e0]">{s.name}</span>
                  <span className="ml-auto text-[10.5px] text-[#62666d]">{s.kind}</span>
                </div>
              ))}
            </div>
          </aside>

          {/* the deploy */}
          <div aria-hidden className="flex min-w-0 flex-col gap-5 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="l-mono text-[13px] text-[#62666d]">#418</span>
              <span className="text-[17px] font-semibold text-white">cache warm before swap</span>
              <span className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] text-[#02b8cc] shadow-[inset_0_0_0_1px_rgba(2,184,204,0.35)]">
                <span className="block size-1.5 animate-pulse-dot rounded-full bg-[#02b8cc]" /> Gating
              </span>
              <span className="l-mono ml-auto text-[11px] text-[#62666d]">7f3c2a1 · lag-01</span>
            </div>

            <div className="l-hair flex flex-col rounded-[10px] bg-[#0f1011]">
              {CONSOLE.gates.map((g, i) => {
                const Icon = GATE_ICON[g.icon as keyof typeof GATE_ICON];
                return (
                  <div key={g.name} className={`flex flex-col gap-2 px-4 py-3 ${i ? "border-t border-[#161718]" : ""}`}>
                    <div className="flex items-center gap-3">
                      <span className="grid size-[18px] place-items-center" style={{ color: g.tone }}>
                        <Icon size={14} />
                      </span>
                      <span className="text-[13px] text-[#e5e5e6]">{g.name}</span>
                      <span className="ml-auto text-[11.5px]" style={{ color: g.tone }}>{g.state}</span>
                    </div>
                    <span className="ml-[30px] block h-[3px] overflow-hidden rounded-sm bg-[#23252a]">
                      <span className="block h-full transition-[width]" style={{ width: `${g.pct}%`, background: g.tone }} />
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="l-mono flex min-h-0 flex-1 flex-col gap-1 overflow-hidden rounded-[10px] bg-[#050506] p-4 text-[11.5px] leading-[1.7] shadow-[inset_0_0_0_1px_#161718]">
              {CONSOLE.logs.map(([t, msg, tone], i) => (
                <div key={i} className="flex gap-4 whitespace-pre">
                  <span className="shrink-0 text-[#383b3f]">{t}</span>
                  <span className="truncate" style={{ color: tone }}>{msg}</span>
                </div>
              ))}
              <span className="l-blink mt-0.5 block h-3.5 w-[7px] bg-[#e4f222]" />
            </div>
          </div>

          {/* the fleet */}
          <aside aria-hidden className="hidden flex-col gap-3 border-l border-[#161718] p-4 lg:flex">
            <span className="l-mono text-[10px] tracking-[0.08em] text-[#62666d]">SERVERS</span>
            {CONSOLE.servers.map((s) => (
              <div key={s.host} className="l-hair flex flex-col gap-1.5 rounded-lg bg-[#0f1011] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Dot tone={s.tone} size={7} />
                  <span className="l-mono text-xs text-[#e5e5e6]">{s.host}</span>
                  <span className="ml-auto text-[11px]" style={{ color: s.tone }}>{s.state}</span>
                </div>
                <div className="flex justify-between text-[10.5px] text-[#62666d]">
                  <span>{s.role}</span>
                  <span className="text-[#8a8f98]">CPU {s.cpu}</span>
                </div>
              </div>
            ))}
            <div className="mt-auto rounded-lg bg-[rgba(235,87,87,0.08)] px-3 py-2.5 text-[11.5px] leading-normal" style={{ color: TONE.crit }}>
              ams-01 disk at 91%. Run cleanup to free 18 GB.
            </div>
          </aside>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[28%] rounded-b-[22px] bg-[linear-gradient(to_bottom,rgba(8,9,10,0),#08090a_92%)]" />
      </div>
    </section>
  );
}
