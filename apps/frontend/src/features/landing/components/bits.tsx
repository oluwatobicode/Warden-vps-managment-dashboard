import type { ReactNode, SVGProps } from "react";
import { TONE } from "../tone";


type IconProps = SVGProps<SVGSVGElement> & { size?: number };
const stroke = (size: number, width: number, rest: SVGProps<SVGSVGElement>) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: width,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...rest,
});

/** The Warden shield. */
export const ShieldIcon = ({ size = 22, strokeWidth = 2, ...p }: IconProps) => (
  <svg {...stroke(size, Number(strokeWidth), p)}>
    <path d="M12 3 4 6v6c0 4.4 3.3 8.2 8 9 4.7-.8 8-4.6 8-9V6l-8-3Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </svg>
);
export const ArrowIcon = ({ size = 14, strokeWidth = 2, ...p }: IconProps) => (
  <svg {...stroke(size, Number(strokeWidth), p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const ChevronIcon = ({ size = 10, strokeWidth = 2.4, ...p }: IconProps) => (
  <svg {...stroke(size, Number(strokeWidth), p)}>
    <path d="m5 9 7 7 7-7" />
  </svg>
);
export const BranchIcon = ({ size = 18, strokeWidth = 1.8, ...p }: IconProps) => (
  <svg {...stroke(size, Number(strokeWidth), p)}>
    <circle cx="6" cy="5" r="2" />
    <circle cx="6" cy="19" r="2" />
    <circle cx="18" cy="8" r="2" />
    <path d="M6 7v10M18 10c0 4-6 3-12 7" />
  </svg>
);
export const BoxIcon = ({ size = 18, strokeWidth = 1.8, ...p }: IconProps) => (
  <svg {...stroke(size, Number(strokeWidth), p)}>
    <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
    <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
  </svg>
);
export const ServerIcon = ({ size = 18, strokeWidth = 1.8, ...p }: IconProps) => (
  <svg {...stroke(size, Number(strokeWidth), p)}>
    <rect x="4" y="4" width="16" height="6" rx="1" />
    <rect x="4" y="14" width="16" height="6" rx="1" />
    <path d="M8 7h.01M8 17h.01" />
  </svg>
);
export const CheckIcon = ({ size = 14, strokeWidth = 2.6, ...p }: IconProps) => (
  <svg {...stroke(size, Number(strokeWidth), p)}>
    <path d="m5 13 4.5 4.5L19 7" />
  </svg>
);
export const CrossIcon = ({ size = 14, strokeWidth = 2.4, ...p }: IconProps) => (
  <svg {...stroke(size, Number(strokeWidth), p)}>
    <path d="M7 7l10 10M17 7 7 17" />
  </svg>
);
export const ClockIcon = ({ size = 14, strokeWidth = 2.6, ...p }: IconProps) => (
  <svg {...stroke(size, Number(strokeWidth), p)}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4l2.5 1.5" />
  </svg>
);
export const WaitIcon = ({ size = 14, strokeWidth = 2.6, ...p }: IconProps) => (
  <svg {...stroke(size, Number(strokeWidth), p)}>
    <circle cx="12" cy="12" r="8" strokeDasharray="3 4" />
  </svg>
);
export const SparkleIcon = ({ size = 16, ...p }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M12 2c.6 5.4 4.6 9.4 10 10-5.4.6-9.4 4.6-10 10-.6-5.4-4.6-9.4-10-10 5.4-.6 9.4-4.6 10-10Z" />
  </svg>
);
export const StarBurstIcon = ({ size = 22, ...p }: IconProps) => (
  <svg {...stroke(size, 1.6, p)}>
    <path d="M10 4c.5 4 2.5 6 6.5 6.5-4 .5-6 2.5-6.5 6.5-.5-4-2.5-6-6.5-6.5 4-.5 6-2.5 6.5-6.5Z" />
    <path d="M19 2v4M17 4h4" />
    <circle cx="5" cy="20" r="1.6" />
  </svg>
);

/** Small mono label above a section heading: "01 — DEPLOYS". */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="l-mono text-xs tracking-[0.08em] text-[#62666d]">{children}</span>;
}

export function LearnMore({ href = "#docs" }: { href?: string }) {
  return (
    <a href={href} className="flex w-max items-center gap-1.5 text-[15px] text-[#8a8f98] hover:text-[#e5e5e6]">
      Learn more <ArrowIcon />
    </a>
  );
}

/** The two-column intro used by Deploys, Fleet and Activity. */
export function SectionIntro({ eyebrow, title, sub, body }: { eyebrow: string; title: string; sub: string; body: string }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-start gap-x-16 gap-y-8">
      <div className="flex flex-col gap-5">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="m-0 text-[clamp(36px,4.6vw,56px)] leading-[1.04] font-semibold tracking-[-1.24px] text-white">
          {title}
          <br />
          <span className="text-[#8a8f98]">{sub}</span>
        </h2>
      </div>
      <div className="flex flex-col gap-10">
        <p className="m-0 text-[clamp(18px,1.8vw,22px)] leading-[1.42] tracking-[-0.26px] text-pretty text-[#d0d6e0]">{body}</p>
        <LearnMore />
      </div>
    </div>
  );
}

/** A coloured status ring: solid, or dashed while something is in progress. */
export function Ring({ tone, dashed = false }: { tone: string; dashed?: boolean }) {
  return <span className="block size-3 shrink-0 rounded-full" style={{ border: `1.5px ${dashed ? "dashed" : "solid"} ${tone}` }} />;
}

export function Dot({ tone, size = 6 }: { tone: string; size?: number }) {
  return <span className="block shrink-0 rounded-full" style={{ width: size, height: size, background: tone }} />;
}

/** A thin usage bar with its label and value. */
export function Meter({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <div className="flex justify-between text-[11px] text-[#62666d]">
        <span>{label}</span>
        <span className="text-[#8a8f98]">{value}%</span>
      </div>
      <span className="block h-[3px] overflow-hidden rounded-sm bg-[#23252a]">
        <span className="block h-full" style={{ width: `${value}%`, background: alert ? TONE.crit : "#e5e5e6" }} />
      </span>
    </div>
  );
}
