import { useId, useMemo, useState } from "react";
import type { MetricPoint } from "shared-types";

const W = 600;
const H = 140;
/** Points further apart than this are a gap (server unreachable), drawn as a break. */
const GAP_MS = 15 * 60 * 1000;

interface Props {
  points: MetricPoint[];
  field: "cpu" | "memory" | "disk";
  color: string;
  label: string;
  windowHours: number;
  /** Right edge of the chart: when this data was fetched. */
  now: number;
}

/**
 * A 24h line + area chart in plain SVG (no chart library). X is real time, so
 * an outage shows as a gap instead of the line quietly joining across it.
 * Hover (or touch) shows the reading nearest the pointer.
 */
export function MetricChart({ points, field, color, label, windowHours, now }: Props) {
  const gradient = useId();
  const [hover, setHover] = useState<number | null>(null);
  const end = now;
  const start = end - windowHours * 3600 * 1000;
  const x = (iso: string) => ((new Date(iso).getTime() - start) / (end - start)) * W;
  const y = (v: number) => H - (Math.min(100, Math.max(0, v)) / 100) * (H - 6) - 3;

  // Split into runs wherever there's a gap.
  const runs = useMemo(() => {
    const out: MetricPoint[][] = [];
    let prev: number | null = null;
    for (const p of points) {
      const t = new Date(p.at).getTime();
      if (prev === null || t - prev > GAP_MS) out.push([]);
      out[out.length - 1].push(p);
      prev = t;
    }
    return out;
  }, [points]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!points.length) return;
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(points[i].at) - px) < Math.abs(x(points[best].at) - px)) best = i;
    setHover(best);
  };
  const h = hover !== null ? points[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block h-[140px] w-full touch-none"
        role="img"
        aria-label={`${label} over the last ${windowHours} hours`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[25, 50, 75].map((v) => (
          <line key={v} x1="0" x2={W} y1={y(v)} y2={y(v)} stroke="var(--color-divider)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
        ))}
        {runs.map((run, i) => {
          const line = run.map((p, j) => `${j ? "L" : "M"}${x(p.at).toFixed(1)},${y(p[field]).toFixed(1)}`).join(" ");
          const area = run.length > 1 ? `${line} L${x(run[run.length - 1].at).toFixed(1)},${H} L${x(run[0].at).toFixed(1)},${H} Z` : "";
          return (
            <g key={i}>
              {area && <path d={area} fill={`url(#${gradient})`} />}
              <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
        {h && <line x1={x(h.at)} x2={x(h.at)} y1="0" y2={H} stroke="var(--color-focus)" vectorEffect="non-scaling-stroke" />}
      </svg>
      {h && (
        <span
          className="pointer-events-none absolute top-1 rounded-md border border-cb bg-raised px-2 py-1 text-[10.5px] whitespace-nowrap text-body"
          style={{ left: `${(x(h.at) / W) * 100}%`, transform: `translateX(${x(h.at) > W / 2 ? "-105%" : "5%"})` }}
        >
          <span className="font-mono">{h[field]}%</span>{" "}
          <span className="text-sand">{new Date(h.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
        </span>
      )}
      <div className="mt-1.5 flex justify-between text-[10px] text-faint">
        <span>{windowHours}h ago</span>
        <span>now</span>
      </div>
    </div>
  );
}
