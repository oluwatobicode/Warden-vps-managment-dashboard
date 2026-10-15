import type { DockerDiskUsage } from "shared-types";
import { formatBytes } from "../../../utils/formatBytes";

const PARTS = [
  { key: "images", label: "Images", color: "var(--color-brand)" },
  { key: "volumes", label: "Volumes", color: "var(--color-good)" },
  { key: "buildCache", label: "Build cache", color: "var(--color-warn)" },
  { key: "containers", label: "Containers", color: "var(--color-serious)" },
] as const;

const R = 42;
const C = 2 * Math.PI * R;

export function DockerDiskDonut({ docker }: { docker: DockerDiskUsage }) {
  const total = docker.total || 1;
  // Each slice starts where the previous one ended.
  const slices = PARTS.map((p, i) => {
    const before = PARTS.slice(0, i).reduce(
      (n, q) => n + (docker[q.key] / total) * C,
      0,
    );
    return { ...p, len: (docker[p.key] / total) * C, offset: before };
  });
  return (
    <div className="flex flex-wrap items-center gap-6">
      {docker.total === 0 ? (
        <p className="m-0 text-xs text-sand">
          Docker has nothing on this disk yet
        </p>
      ) : (
        <>
          <svg
            viewBox="0 0 110 110"
            className="size-[120px] shrink-0 -rotate-90"
            role="img"
            aria-label={`Docker uses ${formatBytes(docker.total)}`}
          >
            <circle
              cx="55"
              cy="55"
              r={R}
              fill="none"
              stroke="var(--color-track)"
              strokeWidth="12"
            />
            {slices.map(
              (p) =>
                p.len > 0 && (
                  <circle
                    key={p.key}
                    cx="55"
                    cy="55"
                    r={R}
                    fill="none"
                    stroke={p.color}
                    strokeWidth="12"
                    strokeDasharray={`${p.len} ${C - p.len}`}
                    strokeDashoffset={-p.offset}
                  />
                ),
            )}
          </svg>
          <div className="flex min-w-[180px] flex-1 flex-col gap-2">
            {PARTS.map((p) => (
              <div key={p.key} className="flex items-center gap-2.5 text-xs">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: p.color }}
                />
                <span className="text-muted-deep">{p.label}</span>
                <span className="ml-auto font-mono text-body">
                  {formatBytes(docker[p.key])}
                </span>
              </div>
            ))}
            <div className="mt-1 flex items-center gap-2.5 border-t border-divider pt-2.5 text-xs">
              <span className="text-muted-deep">Total</span>
              <span className="ml-auto font-mono text-strong">
                {formatBytes(docker.total)}
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-xs">
              <span className="text-good">Reclaimable</span>
              <span className="ml-auto font-mono text-good">
                {formatBytes(docker.reclaimable)}
              </span>
            </div>
            <p className="m-0 text-[10.5px] text-faint">
              Docker's own estimate. It counts unused images too, which cleanup
              keeps so rollbacks still work.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
