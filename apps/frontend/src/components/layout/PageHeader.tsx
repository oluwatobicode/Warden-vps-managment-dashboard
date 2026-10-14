import type { ReactNode } from "react";

/** The big "CONSOLE / Projects" title row, with an optional right-hand slot. */
export function PageHeader({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-5">
      <div>
        <p className="m-0 text-[11px] font-bold tracking-[.35em] text-sand">CONSOLE</p>
        <h1 className="mt-2.5 text-[clamp(34px,4.5vw,52px)] leading-none font-extrabold tracking-[-1.2px] text-strong">{title}</h1>
      </div>
      {aside && <div className="flex items-center gap-4">{aside}</div>}
    </div>
  );
}
