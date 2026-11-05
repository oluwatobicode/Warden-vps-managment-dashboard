import type { ReactNode } from "react";

/** One headline number with a label and a quiet line under it. */
export function StatTile({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "crit" | "warn" }) {
  return (
    <div className={`flex flex-col gap-2.5 rounded-[18px] border bg-ink px-5 py-[18px] ${tone === "crit" ? "border-crit-border" : "border-cb"}`}>
      <span className="text-[10.5px] font-semibold tracking-[.08em] text-sand uppercase">{label}</span>
      <span className={`font-display text-[30px] leading-none font-extrabold ${tone === "crit" ? "text-crit" : tone === "warn" ? "text-warn" : "text-strong"}`}>{value}</span>
      {sub && <span className="text-[11.5px] text-muted-deep">{sub}</span>}
    </div>
  );
}

// Columns per tile count, so a row never leaves one tile alone on the next line.
const COLS = {
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-2 xl:grid-cols-4",
  5: "grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  6: "grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6",
} as const;

/** A row of tiles; `count` is how many it holds. */
export function TileGrid({ count, children }: { count: keyof typeof COLS; children: ReactNode }) {
  return <div className={`grid gap-3 ${COLS[count]}`}>{children}</div>;
}

/** label ····· n rows, for small breakdowns (by status, by provider). */
export function Breakdown({ rows }: { rows: Array<{ label: string; value: ReactNode; dot?: string }> }) {
  return (
    <div className="mt-3">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-3 border-t border-divider py-[9px]">
          <span className="flex min-w-0 items-center gap-2 text-xs text-muted-deep">
            {r.dot && <span className={`size-1.5 shrink-0 rounded-full ${r.dot}`} />}
            <span className="truncate">{r.label}</span>
          </span>
          <span className="font-mono text-xs text-body">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
