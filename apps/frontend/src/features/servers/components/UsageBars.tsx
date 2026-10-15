import type { ServerUsage } from "shared-types";

/** Colour by how full: fine, getting there, act now. Text always says the number too. */
const usageTone = (pct: number) => (pct >= 90 ? "bg-crit" : pct >= 75 ? "bg-warn" : "bg-muted-deep");

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex min-w-[64px] flex-1 flex-col gap-1.5">
      <span className="flex justify-between text-[10px] text-sand">
        <span>{label}</span>
        <span className={value >= 90 ? "text-crit" : "text-muted-warm"}>{Math.round(value)}%</span>
      </span>
      <span className="block h-[3px] overflow-hidden rounded-full bg-track">
        <span className={`block h-full rounded-full ${usageTone(value)}`} style={{ width: `${Math.min(100, value)}%` }} />
      </span>
    </span>
  );
}

/** CPU / MEM / DISK for a server card, from the latest poll. */
export function UsageBars({ usage }: { usage: ServerUsage | null }) {
  if (!usage) return <span className="text-[10.5px] text-faint">No readings yet</span>;
  return (
    <span className="flex w-full gap-3" aria-label={`CPU ${usage.cpu}%, memory ${usage.memory}%, disk ${usage.disk}%`}>
      <Bar label="CPU" value={usage.cpu} />
      <Bar label="MEM" value={usage.memory} />
      <Bar label="DISK" value={usage.disk} />
    </span>
  );
}
