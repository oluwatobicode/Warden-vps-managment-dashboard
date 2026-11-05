import { PLATFORM_LIMITS, type PlatformHealth } from "shared-types";
import { Card } from "../../../components/ui/Card";
import { formatBytes } from "../../../utils/formatBytes";
import { timeAgo } from "../../../utils/formatDate";
import { fmtInt } from "../format";
import { StatTile, TileGrid } from "./StatTile";

const WORKER_TEXT = { ok: "polling", silent: "silent", "no-servers": "nothing to poll" } as const;

/** Warden's own Postgres, Redis, queues and worker. Red = act on it. */
export function HealthTab({ data }: { data: PlatformHealth }) {
  const pgBig = data.postgres.sizeBytes > PLATFORM_LIMITS.postgresWarnBytes;
  const failed = data.queues.reduce((n, q) => n + q.failed, 0);
  const silent = data.worker.state === "silent";
  const collectorShort = data.logCollector.leases < data.logCollector.servers;

  return (
    <div className="flex flex-col gap-5">
      <TileGrid count={5}>
        <StatTile
          label="Worker loop"
          value={WORKER_TEXT[data.worker.state]}
          tone={silent ? "crit" : undefined}
          sub={data.worker.lastMetricsAt ? `last metrics ${timeAgo(data.worker.lastMetricsAt)}` : "no metrics yet"}
        />
        <StatTile label="Failed jobs" value={fmtInt(failed)} tone={failed ? "crit" : undefined} sub="across all queues" />
        <StatTile
          label="Postgres"
          value={formatBytes(data.postgres.sizeBytes)}
          tone={pgBig ? "crit" : undefined}
          sub={`warns over ${formatBytes(PLATFORM_LIMITS.postgresWarnBytes)}`}
        />
        <StatTile
          label="Redis memory"
          value={formatBytes(data.redis.usedMemoryBytes)}
          sub={data.redis.maxMemoryBytes ? `of ${formatBytes(data.redis.maxMemoryBytes)}` : "no maxmemory set"}
        />
        <StatTile
          label="Log collector"
          value={`${data.logCollector.leases} / ${data.logCollector.servers}`}
          tone={collectorShort ? "warn" : undefined}
          sub="servers being collected"
        />
      </TileGrid>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Queues" sub="BullMQ job counts, right now">
          <table className="mt-3 w-full text-left text-xs">
            <thead className="text-[10.5px] tracking-[.06em] text-sand uppercase">
              <tr>
                {["Queue", "Waiting", "Active", "Delayed", "Failed"].map((h, i) => (
                  <th key={h} className={`py-2 font-semibold ${i ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.queues.map((q) => (
                <tr key={q.name} className="border-t border-divider font-mono text-body">
                  <td className="py-[9px]">{q.name}</td>
                  <td className="text-right">{q.waiting}</td>
                  <td className="text-right">{q.active}</td>
                  <td className="text-right">{q.delayed}</td>
                  <td className={`text-right ${q.failed ? "text-crit" : ""}`}>{q.failed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Biggest tables" sub="Size on disk with indexes; rows are Postgres's estimate">
          <table className="mt-3 w-full text-left text-xs">
            <thead className="text-[10.5px] tracking-[.06em] text-sand uppercase">
              <tr>
                <th className="py-2 font-semibold">Table</th>
                <th className="py-2 text-right font-semibold">Size</th>
                <th className="py-2 text-right font-semibold">~Rows</th>
              </tr>
            </thead>
            <tbody>
              {data.postgres.tables.map((t) => (
                <tr key={t.name} className="border-t border-divider font-mono text-body">
                  <td className="py-[9px]">{t.name}</td>
                  <td className="text-right">{formatBytes(t.sizeBytes)}</td>
                  <td className="text-right">{t.approxRows === null ? "—" : fmtInt(t.approxRows)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
