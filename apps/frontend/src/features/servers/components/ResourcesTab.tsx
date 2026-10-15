import type { ServerMetrics } from "shared-types";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Skeleton } from "../../../components/ui/Skeleton";
import { apiMessage } from "../../../utils/apiMessage";
import { formatBytes } from "../../../utils/formatBytes";
import { timeAgo } from "../../../utils/formatDate";
import { useServerMetrics } from "../hooks/useMonitoring";
import { DockerDiskDonut } from "./DockerDiskDonut";
import { MetricChart } from "./MetricChart";
import { LastCleanup } from "./LastCleanup";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-[10px] tracking-[.04em] text-sand uppercase">
        {label}
      </span>
      <span className="font-mono text-xs text-body">{value}</span>
    </span>
  );
}

const pct = (n: number) => `${n}%`;

function ResourceCard({
  title,
  stat,
  detail,
  extra,
  field,
  color,
  data,
  now,
}: {
  title: string;
  stat: { current: number; peak: number; avg: number };
  detail?: string;
  extra?: React.ReactNode;
  field: "cpu" | "memory" | "disk";
  color: string;
  data: ServerMetrics;
  now: number;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="m-0 text-[13px] font-bold text-strong">{title}</h3>
          <span className="flex items-baseline gap-2">
            <span className="font-mono text-[26px] font-semibold tracking-[-0.5px] text-strong">
              {pct(stat.current)}
            </span>
            {detail && (
              <span className="truncate text-[11.5px] text-sand">{detail}</span>
            )}
          </span>
        </div>
        <span className="flex shrink-0 gap-5">
          <Stat label="Peak" value={pct(stat.peak)} />
          <Stat label="Avg" value={pct(stat.avg)} />
          {extra}
        </span>
      </div>
      <div className="mt-4">
        <MetricChart
          points={data.points}
          field={field}
          color={color}
          label={title}
          windowHours={data.windowHours}
          now={now}
        />
      </div>
    </Card>
  );
}

/** CPU, memory and disk over 24h, and what Docker's disk is spent on. Refreshes every minute. */
export function ResourcesTab({ serverId }: { serverId: string }) {
  const metrics = useServerMetrics(serverId);

  if (metrics.isPending)
    return <Skeleton className="mt-5 h-72 rounded-[18px]" />;
  if (metrics.isError)
    return (
      <p className="mt-5 text-sm text-crit">{apiMessage(metrics.error)}</p>
    );
  const m = metrics.data;
  if (!m.cpu || !m.memory || !m.disk) {
    return (
      <div className="mt-5">
        <EmptyState title="No readings yet">
          Warden reads CPU, memory and disk from this server every minute. If
          nothing shows up after a couple of minutes, check the server is
          reachable with Test connection.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mt-5 flex flex-col gap-3.5 pb-2">
      <p className="m-0 text-[11.5px] text-sand">
        Last {m.windowHours} hours · updated{" "}
        {m.collectedAt ? timeAgo(m.collectedAt) : "never"} · readings every
        minute, charted as 5-minute averages
      </p>
      <ResourceCard
        title="CPU"
        stat={m.cpu}
        field="cpu"
        color="var(--color-brand)"
        data={m}
        now={metrics.dataUpdatedAt}
        extra={
          m.load && (
            <Stat
              label="Load"
              value={`${m.load.one.toFixed(2)} · ${m.load.five.toFixed(2)} · ${m.load.fifteen.toFixed(2)}`}
            />
          )
        }
      />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-3.5">
        <ResourceCard
          title="Memory"
          stat={m.memory}
          detail={`${formatBytes(m.memory.usedBytes)} of ${formatBytes(m.memory.totalBytes)}`}
          field="memory"
          color="var(--color-good)"
          data={m}
          now={metrics.dataUpdatedAt}
        />
        <ResourceCard
          title="Disk"
          stat={m.disk}
          detail={`${formatBytes(m.disk.usedBytes)} of ${formatBytes(m.disk.totalBytes)}`}
          field="disk"
          color={
            m.disk.current >= 90 ? "var(--color-crit)" : "var(--color-warn)"
          }
          data={m}
          now={metrics.dataUpdatedAt}
        />
      </div>
      <Card
        title="Docker disk"
        sub={
          m.docker
            ? `Measured ${timeAgo(m.docker.collectedAt)} · checked every 10 minutes`
            : undefined
        }
      >
        <div className="mt-4">
          {m.docker ? (
            <DockerDiskDonut docker={m.docker} />
          ) : (
            <p className="m-0 text-xs text-sand">
              No Docker numbers yet. They appear within 10 minutes if Docker is
              installed and this SSH user can use it.
            </p>
          )}
        </div>
        <LastCleanup serverId={serverId} />
      </Card>
    </div>
  );
}
