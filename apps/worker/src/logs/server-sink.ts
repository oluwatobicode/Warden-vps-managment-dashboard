import { prisma } from "db";
import { serverLogChannel, type ServerLogLine, type ServerLogSource } from "shared-types";
import { log } from "../log";
import { redis } from "../redis";
import { normalizeTs, RateLimit } from "./lines";

const FLUSH_MS = 1000;
const BATCH = 500;
const MAX_PENDING = 20_000;
const CURSOR_TTL_S = 8 * 24 * 3600;

/** Where a server source has been saved up to: a timestamp (Traefik) or the journal's own cursor. */
export const serverCursorKey = (serverId: string, source: ServerLogSource) => `logs:server-cursor:${serverId}:${source}`;

export interface PendingServerLine {
  organizationId: string;
  serverId: string;
  source: ServerLogSource;
  /** Normalized (see normalizeTs). */
  ts: string;
  /** Cleaned already. */
  message: string;
  /** The position after this line. Journal cursors only move forward in order; timestamps are kept at their max. */
  cursor: string | null;
  dropped?: true;
}

/**
 * Like LogSink, for a server's own logs: rate-limited per server and source
 * (a noisy journal mustn't flood the table), saved in batches to ServerLog,
 * published on server-log:<id>, then each source's cursor moves on.
 */
export class ServerLogSink {
  private pending: PendingServerLine[] = [];
  private readonly limits = new Map<string, { limit: RateLimit; line: PendingServerLine; lastSeen: number }>();
  private chain: Promise<void> = Promise.resolve();
  private readonly timer: NodeJS.Timeout;
  private lastWarn = 0;

  constructor() {
    this.timer = setInterval(() => void this.flush(), FLUSH_MS);
  }

  offer(line: PendingServerLine): void {
    const now = Date.now();
    const key = `${line.serverId}:${line.source}`;
    let l = this.limits.get(key);
    if (!l) {
      l = { limit: new RateLimit(), line, lastSeen: now };
      this.limits.set(key, l);
    }
    l.lastSeen = now;
    if (this.pending.length >= MAX_PENDING) return;
    this.pending.push(l.limit.allow(now) ? line : { ...line, message: "", dropped: true });
    if (this.pending.length >= BATCH) void this.flush();
  }

  private flush(force = false): Promise<void> {
    const now = Date.now();
    for (const [key, l] of this.limits) {
      const dropped = l.limit.takeDropped(now, force);
      if (dropped) {
        this.pending.push({
          organizationId: l.line.organizationId,
          serverId: l.line.serverId,
          source: "WARDEN",
          ts: normalizeTs(new Date(now).toISOString())!,
          message: `${dropped.toLocaleString("en-US")} ${l.line.source.toLowerCase()} lines dropped: more than ${l.limit.perSecond} a second`,
          cursor: null,
        });
      } else if (now - l.lastSeen > 10 * 60_000) this.limits.delete(key);
    }
    if (!this.pending.length) return this.chain;
    const batch = this.pending.splice(0, BATCH);
    this.chain = this.chain.then(() => this.write(batch));
    if (this.pending.length) return this.flush(force);
    return this.chain;
  }

  private async write(batch: PendingServerLine[]): Promise<void> {
    try {
      await this.save(batch);
    } catch (e) {
      // A server deleted mid-stream: keep the lines of the ones that still exist.
      if ((e as { code?: string }).code === "P2003") {
        const ids = [...new Set(batch.map((l) => l.serverId))];
        const alive = new Set((await prisma.server.findMany({ where: { id: { in: ids } }, select: { id: true } }).catch(() => [])).map((s) => s.id));
        const kept = batch.filter((l) => alive.has(l.serverId));
        if (kept.length && kept.length < batch.length) return this.write(kept);
        if (!kept.length) return;
      }
      if (Date.now() - this.lastWarn > 60_000) {
        this.lastWarn = Date.now();
        log.warn(`logs: couldn't save ${batch.length} server line(s): ${(e as Error).message.split("\n")[0]}`);
      }
    }
  }

  private async save(batch: PendingServerLine[]): Promise<void> {
    const kept = batch.filter((l) => !l.dropped);
    const rows = kept.length
      ? await prisma.serverLog.createManyAndReturn({
          data: kept.map((l) => ({ organizationId: l.organizationId, serverId: l.serverId, source: l.source, ts: new Date(l.ts), message: l.message })),
          select: { id: true, serverId: true, source: true, ts: true, message: true },
        })
      : [];
    const byServer = new Map<string, ServerLogLine[]>();
    for (const r of rows) {
      const line: ServerLogLine = { ...r, id: r.id.toString(), ts: r.ts.toISOString() };
      const list = byServer.get(r.serverId);
      if (list) list.push(line);
      else byServer.set(r.serverId, [line]);
    }
    const cursors = new Map<string, string>();
    for (const l of batch) {
      if (!l.cursor) continue;
      const key = serverCursorKey(l.serverId, l.source);
      // Traefik: stdout and stderr can arrive out of order, so keep the newest time.
      // Journal: one stream, in order, so the last cursor is the newest.
      if (l.source !== "TRAEFIK" || l.cursor > (cursors.get(key) ?? "")) cursors.set(key, l.cursor);
    }
    const multi = redis.multi();
    for (const [serverId, lines] of byServer) multi.publish(serverLogChannel(serverId), JSON.stringify(lines));
    for (const [key, value] of cursors) multi.set(key, value, "EX", CURSOR_TTL_S);
    await multi.exec();
  }

  async close(): Promise<void> {
    clearInterval(this.timer);
    await this.flush(true);
  }
}

/**
 * A line Warden writes in a server's log itself (went offline, a cleanup
 * finished…). Never throws: a missing log line mustn't fail the job.
 */
export async function serverEvent(server: { id: string; organizationId: string }, message: string): Promise<void> {
  try {
    const r = await prisma.serverLog.create({
      data: { organizationId: server.organizationId, serverId: server.id, source: "WARDEN", ts: new Date(), message },
      select: { id: true, serverId: true, source: true, ts: true, message: true },
    });
    const line: ServerLogLine = { ...r, id: r.id.toString(), ts: r.ts.toISOString() };
    await redis.publish(serverLogChannel(server.id), JSON.stringify([line]));
  } catch (e) {
    log.warn(`logs: couldn't write a server event: ${(e as Error).message.split("\n")[0]}`);
  }
}
