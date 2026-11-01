import { prisma } from "db";
import { serviceLogChannel, type LogLine, type LogStream } from "shared-types";
import { log } from "../log";
import { redis } from "../redis";
import { RateLimit, normalizeTs } from "./lines";

const FLUSH_MS = 1000;
const BATCH = 500;
/** If Postgres is down, lines past this are dropped rather than filling memory. */
const MAX_PENDING = 20_000;
const CURSOR_TTL_S = 8 * 24 * 3600;

/** Where a container's log has been saved up to (a normalized timestamp). */
export const cursorKey = (containerId: string) => `logs:cursor:${containerId}`;

export interface PendingLine {
  organizationId: string;
  serviceId: string;
  deploymentId: string | null;
  stream: LogStream;
  /** Normalized (see normalizeTs). */
  ts: string;
  /** Cleaned and masked already. */
  message: string;
  /** For the cursor; null for Warden's own lines. */
  containerId: string | null;
  /** Over the rate limit: not saved, but the cursor moves past it (so a restart doesn't read it again). */
  dropped?: true;
}

interface Limit {
  limit: RateLimit;
  organizationId: string;
  deploymentId: string | null;
  lastSeen: number;
}

/**
 * Every collector's lines go through here: rate-limited per service, saved
 * in batches (one insert per second or 500 lines), then published on Redis
 * for live viewers, then each container's cursor moves on. Writes run one at
 * a time, so cursors only move forward.
 */
export class LogSink {
  private pending: PendingLine[] = [];
  private readonly limits = new Map<string, Limit>();
  private chain: Promise<void> = Promise.resolve();
  private readonly timer: NodeJS.Timeout;
  private lastWarn = 0;

  constructor() {
    this.timer = setInterval(() => void this.flush(), FLUSH_MS);
  }

  offer(line: PendingLine): void {
    const now = Date.now();
    let l = this.limits.get(line.serviceId);
    if (!l) {
      l = { limit: new RateLimit(), organizationId: line.organizationId, deploymentId: line.deploymentId, lastSeen: now };
      this.limits.set(line.serviceId, l);
    }
    l.lastSeen = now;
    l.deploymentId = line.deploymentId;
    if (this.pending.length >= MAX_PENDING) return;
    this.pending.push(l.limit.allow(now) ? line : { ...line, message: "", dropped: true });
    if (this.pending.length >= BATCH) void this.flush();
  }

  private flush(force = false): Promise<void> {
    const now = Date.now();
    for (const [serviceId, l] of this.limits) {
      const dropped = l.limit.takeDropped(now, force);
      if (dropped) {
        this.pending.push({
          organizationId: l.organizationId,
          serviceId,
          deploymentId: l.deploymentId,
          stream: "WARDEN",
          ts: normalizeTs(new Date(now).toISOString())!,
          message: `${dropped.toLocaleString("en-US")} lines dropped: this service printed more than ${l.limit.perSecond} lines a second`,
          containerId: null,
        });
      } else if (now - l.lastSeen > 10 * 60_000) this.limits.delete(serviceId);
    }
    if (!this.pending.length) return this.chain;
    const batch = this.pending.splice(0, BATCH);
    this.chain = this.chain.then(() => this.write(batch));
    if (this.pending.length) return this.flush(force);
    return this.chain;
  }

  private async write(batch: PendingLine[]): Promise<void> {
    try {
      await this.save(batch);
    } catch (e) {
      // A service deleted mid-stream fails the whole insert (its FK is gone):
      // keep the lines of the services that still exist.
      if ((e as { code?: string }).code === "P2003") {
        const ids = [...new Set(batch.map((l) => l.serviceId))];
        const alive = new Set((await prisma.service.findMany({ where: { id: { in: ids } }, select: { id: true } }).catch(() => [])).map((s) => s.id));
        const kept = batch.filter((l) => alive.has(l.serviceId));
        if (kept.length && kept.length < batch.length) return this.write(kept);
        if (!kept.length) return;
      }
      // Lost lines must never stop the collector. Said once a minute, not per batch.
      if (Date.now() - this.lastWarn > 60_000) {
        this.lastWarn = Date.now();
        log.warn(`logs: couldn't save ${batch.length} line(s): ${(e as Error).message.split("\n")[0]}`);
      }
    }
  }

  private async save(batch: PendingLine[]): Promise<void> {
    const kept = batch.filter((l) => !l.dropped);
    const rows = kept.length
      ? await prisma.serviceLog.createManyAndReturn({
          data: kept.map((l) => ({
            organizationId: l.organizationId,
            serviceId: l.serviceId,
            deploymentId: l.deploymentId,
            stream: l.stream,
            ts: new Date(l.ts),
            message: l.message,
          })),
          select: { id: true, serviceId: true, deploymentId: true, stream: true, ts: true, message: true },
        })
      : [];
    const byService = new Map<string, LogLine[]>();
    for (const r of rows) {
      const line: LogLine = { ...r, id: r.id.toString(), ts: r.ts.toISOString() };
      const list = byService.get(r.serviceId);
      if (list) list.push(line);
      else byService.set(r.serviceId, [line]);
    }
    const cursors = new Map<string, string>();
    for (const l of batch) if (l.containerId && l.ts > (cursors.get(l.containerId) ?? "")) cursors.set(l.containerId, l.ts);
    const multi = redis.multi();
    for (const [serviceId, lines] of byService) multi.publish(serviceLogChannel(serviceId), JSON.stringify(lines));
    for (const [containerId, ts] of cursors) multi.set(cursorKey(containerId), ts, "EX", CURSOR_TTL_S);
    await multi.exec();
  }

  async close(): Promise<void> {
    clearInterval(this.timer);
    await this.flush(true);
  }
}
