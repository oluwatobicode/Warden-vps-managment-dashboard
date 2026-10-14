import type { ReactNode } from "react";

/** The bordered section box used everywhere (General, Danger zone, lists). */
export function Card({ title, sub, action, children, className = "" }: { title?: string; sub?: string; action?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[18px] border border-cb bg-card px-[22px] py-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3.5">
          <div className="min-w-0">
            {title && <h3 className="m-0 text-[14.5px] font-bold text-strong">{title}</h3>}
            {sub && <p className="mt-[7px] text-[11.5px] text-sand">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Red box at the bottom of settings pages. */
export function DangerZone({ body, action }: { body: string; action: ReactNode }) {
  return (
    <section className="flex items-center justify-between gap-5 rounded-[18px] border border-crit-border bg-crit-s px-[21px] py-[19px]">
      <div className="min-w-0">
        <h3 className="m-0 text-[14.5px] font-bold text-[#f3b9b9]">Danger zone</h3>
        <p className="mt-[7px] text-[11.5px] text-pretty text-[#c99494]">{body}</p>
      </div>
      {action}
    </section>
  );
}

/** label ······ value rows inside a Card. */
export function FactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-divider py-[11px]">
      <span className="text-xs text-muted-deep">{label}</span>
      <span className="min-w-0 truncate font-mono text-xs text-body">{children}</span>
    </div>
  );
}

export function Chip({ children, mono = false }: { children: ReactNode; mono?: boolean }) {
  return <span className={`rounded-md bg-chip px-2 py-[3px] text-[10.5px] font-semibold whitespace-nowrap text-muted-deep ${mono ? "font-mono" : ""}`}>{children}</span>;
}

/** Page title + one-line description + optional action on the right. */
export function SectionHeader({ title, sub, action, mono = false }: { title: string; sub?: ReactNode; action?: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <h2 className={`m-0 text-[26px] font-bold tracking-[-0.5px] text-strong ${mono ? "font-mono text-2xl font-semibold" : ""}`}>{title}</h2>
        {sub && <div className="mt-[9px] text-[13px] text-muted-warm">{sub}</div>}
      </div>
      {action && <div className="flex shrink-0 gap-[9px]">{action}</div>}
    </div>
  );
}
