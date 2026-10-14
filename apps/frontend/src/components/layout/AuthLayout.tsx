import type { ReactNode } from "react";
import { WardenMark } from "../ui/WardenMark";

/** Login / signup / reset: centred card on the canvas with faint infra line art. */
export function AuthLayout({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center gap-[22px] px-6 py-10">
      <Backdrop />
      <div className="relative">
        <WardenMark />
      </div>
      <section className="relative flex w-[452px] max-w-full flex-col rounded-[20px] border border-cb bg-surface px-[34px] py-8">
        {children}
      </section>
      {footer && <p className="relative m-0 text-xs text-muted-warm">{footer}</p>}
    </div>
  );
}

/** Decorative only: hidden from screen readers. */
function Backdrop() {
  const line = { fill: "none", stroke: "#ffffff", strokeWidth: 1.1 } as const;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg width="330" height="330" viewBox="0 0 100 100" {...line} strokeOpacity={0.05} className="absolute -top-[52px] -left-16 -rotate-[8deg]">
        <rect x="12" y="14" width="76" height="20" rx="3" /><rect x="12" y="40" width="76" height="20" rx="3" /><rect x="12" y="66" width="76" height="20" rx="3" />
        <circle cx="22" cy="24" r="2.4" /><circle cx="22" cy="50" r="2.4" /><circle cx="22" cy="76" r="2.4" />
        <path d="M70 24h10M70 50h10M70 76h10" />
      </svg>
      <svg width="280" height="280" viewBox="0 0 100 100" {...line} strokeOpacity={0.045} className="absolute top-[8%] -right-[78px] rotate-[11deg]">
        <ellipse cx="50" cy="22" rx="30" ry="11" />
        <path d="M20 22v56c0 6 13.4 11 30 11s30-5 30-11V22" />
        <path d="M20 44c0 6 13.4 11 30 11s30-5 30-11M20 62c0 6 13.4 11 30 11s30-5 30-11" />
      </svg>
      <svg width="260" height="260" viewBox="0 0 100 100" {...line} strokeOpacity={0.05} className="absolute -bottom-[70px] left-[9%] rotate-[7deg]">
        <path d="M50 10 88 30 50 50 12 30 50 10Z" /><path d="M12 50l38 20 38-20" /><path d="M12 70l38 20 38-20" />
      </svg>
      <svg width="240" height="240" viewBox="0 0 100 100" {...line} strokeOpacity={0.04} className="absolute right-[9%] bottom-[5%] -rotate-[7deg]">
        <rect x="8" y="16" width="84" height="68" rx="5" /><path d="M8 32h84" />
        <path d="M24 48l10 10-10 10M46 68h22" strokeLinecap="round" />
      </svg>
      <svg width="200" height="200" viewBox="0 0 100 100" {...line} strokeOpacity={0.035} className="absolute top-[34%] left-[15%] rotate-[4deg]">
        <circle cx="50" cy="18" r="8" /><circle cx="18" cy="72" r="8" /><circle cx="82" cy="72" r="8" />
        <path d="M45 25 23 65M55 25l22 40M26 72h48" />
      </svg>
    </div>
  );
}
