import type { CSSProperties, ReactNode } from "react";
import { GATE_FIGURES } from "../data";
import { Eyebrow } from "./bits";

const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;
const line = { fill: "none", stroke: "#383b3f", strokeWidth: 1, strokeLinejoin: "round" as const };

/** One isometric slab, the building block of the first two figures. */
function Slab({ y, className, style }: { y: number; className?: string; style?: CSSProperties }) {
  return (
    <g transform={`translate(0,${y})`} className={className} style={style}>
      <polygon points="40,30 100,0 160,30 160,42 100,72 40,42" {...line} fill="#08090a" />
      <polyline points="40,30 100,60 160,30" {...line} />
      <line x1="100" y1="60" x2="100" y2="72" {...line} />
    </g>
  );
}

const BAR_POINTS = [
  "36,110 76,90 76,64 36,84",
  "50,117 90,97 90,67 50,87",
  "64,124 104,104 104,80 64,100",
  "78,131 118,111 118,77 78,97",
  "92,138 132,118 132,90 92,110",
  "106,145 146,125 146,103 106,123",
  "120,152 160,132 160,102 120,122",
  "134,159 174,139 174,113 134,133",
  "148,166 188,146 188,122 148,142",
];
const SWAP_PATH = "M60 96 C 70 46, 120 36, 138 70";

const FIGURES: ReactNode[] = [
  // 0.1 container running: slabs stack, a ring pulses on top
  <>
    {[92, 70, 48].map((y, i) => <Slab key={y} y={y} className="l-fl" style={delay(i * 260)} />)}
    <ellipse className="l-ring" cx="100" cy="78" rx="18" ry="9" fill="none" stroke="#27a644" strokeWidth="1" />
    <circle className="l-ringdot" cx="100" cy="78" r="2" fill="#27a644" />
  </>,
  // 0.2 http health check: a heartbeat traced over the slab
  <>
    <Slab y={100} />
    <line x1="40" y1="70" x2="40" y2="130" stroke="#23252a" strokeDasharray="2 3" />
    <line x1="160" y1="70" x2="160" y2="130" stroke="#23252a" strokeDasharray="2 3" />
    <line x1="100" y1="70" x2="100" y2="100" stroke="#23252a" strokeDasharray="2 3" />
    <polyline className="l-pulse" pathLength={1} points="40,70 70,70 80,48 92,96 104,58 114,70 160,70" fill="none" stroke="#02b8cc" strokeWidth="1.2" strokeLinejoin="round" />
  </>,
  // 0.3 error-rate window: bars, the last one crosses the threshold
  <>
    {BAR_POINTS.map((p, i) => (
      <polygon
        key={p}
        className={i === 8 ? "l-bar-alert" : "l-bar"}
        style={delay(i * 140)}
        points={p}
        fill="#08090a"
        stroke={i === 8 ? "#02b8cc" : "#383b3f"}
        strokeWidth="1"
        strokeLinejoin="round"
      />
    ))}
    <line className="l-thresh" x1="36" y1="60" x2="148" y2="116" stroke="#eb5757" strokeOpacity="0.7" strokeDasharray="3 3" />
  </>,
  // 0.4 traffic swap: requests hop from the old container to the new one
  <>
    <polygon className="l-sw-old" points="30,115 60,100 90,115 90,125 60,140 30,125" {...line} fill="#08090a" />
    <polyline points="30,115 60,130 90,115" {...line} />
    <line x1="60" y1="130" x2="60" y2="140" {...line} />
    <polygon className="l-sw-new" points="110,95 140,80 170,95 170,105 140,120 110,105" {...line} stroke="#e5e5e6" fill="#08090a" />
    <polyline points="110,95 140,110 170,95" {...line} stroke="#e5e5e6" />
    <line x1="140" y1="110" x2="140" y2="120" {...line} stroke="#e5e5e6" />
    <path d={SWAP_PATH} fill="none" stroke="#e5e5e6" strokeWidth="1" strokeDasharray="3 3" />
    {[
      { r: 2.5, begin: "0s", max: 1 },
      { r: 2, begin: "0.8s", max: 0.7 },
    ].map((d) => (
      <circle key={d.begin} r={d.r} fill="#e4f222">
        <animateMotion dur="2.4s" begin={d.begin} repeatCount="indefinite" path={SWAP_PATH} keyPoints="0;1;1" keyTimes="0;0.6;1" calcMode="linear" />
        <animate attributeName="opacity" values={`0;${d.max};${d.max};0;0`} keyTimes="0;0.1;0.55;0.62;1" dur="2.4s" begin={d.begin} repeatCount="indefinite" />
      </circle>
    ))}
    <polyline points="131,66 138,72 141,63" fill="none" stroke="#e5e5e6" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
  </>,
];

export function GatesSection() {
  return (
    <section id="gates" className="mx-auto flex max-w-[1200px] flex-col gap-24 px-6 pt-36 pb-32">
      <div className="flex flex-col gap-5">
        <Eyebrow>02 — HEALTH GATES</Eyebrow>
        <h2 className="m-0 max-w-[1100px] text-[clamp(32px,4.2vw,48px)] leading-[1.08] font-semibold tracking-[-1.056px] text-pretty text-white">
          Traffic moves only when the new container is healthy.{" "}
          <span className="text-[#8a8f98]">Every deploy passes through gates you define. If one fails, the old container keeps serving and nothing changes for your users.</span>
        </h2>
      </div>
      <div className="-mx-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-y-16 overflow-hidden">
        {GATE_FIGURES.map((f, i) => (
          <div key={f.fig} className="-ml-px flex flex-col gap-6 border-l border-[#161718] px-6 pb-2">
            <span className="l-mono text-[11px] tracking-[0.08em] text-[#62666d]">{f.fig}</span>
            <div className="grid aspect-square w-full max-w-[280px] place-items-center self-center">
              <svg width="100%" height="100%" viewBox="0 0 200 200" aria-hidden>
                {FIGURES[i]}
              </svg>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <span className="text-[15px] font-[510] tracking-[-0.165px] text-[#e5e5e6]">{f.title}</span>
              <span className="text-[15px] leading-[1.6] tracking-[-0.165px] text-pretty text-[#8a8f98]">{f.text}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
