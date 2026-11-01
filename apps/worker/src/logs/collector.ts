import { randomUUID } from "node:crypto";
import { prisma, type LogStream } from "db";
import { serverSourcesKey } from "shared-types";
import { openSsh, type Follow, type SshSession } from "ssh-client";
import { sshTargetFor } from "../keys";
import { log } from "../log";
import { redis } from "../redis";
import { cleanLine, EVENTS_COMMAND, followCommand, LineSplitter, LIST_COMMAND, normalizeTs, parseContainerList, parseLogLine, type RunningContainer } from "./lines";
import { maskerFor } from "./secrets";
import { FOLLOWED_SOURCES, journalFollowCommand, parseJournalLine, parseProbe, PROBE_COMMAND, traefikFollowCommand, type FollowedSource } from "./server-lines";
import { serverCursorKey, ServerLogSink } from "./server-sink";
import { cursorKey, LogSink } from "./sink";

/*
 * App logs: follows every running Warden container (label warden.service)
 * with `docker logs -f` over SSH and hands each line to the sink. Not a
 * BullMQ job, because these streams never finish. One collector per server,
 * across all workers (a Redis lease), and it picks up where it left off
 * after a disconnect or restart (a cursor per container).
 *
 * The same connection also follows the server's own logs (Traefik, the
 * Docker daemon's journal, the system journal's warnings), when it can read
 * them; what it can read is kept in Redis for the server page.
 */

/** sshd allows ~10 channels per connection (MaxSessions); this leaves room for commands. */
const CHANNELS_PER_CONNECTION = 8;
const MAX_CONNECTIONS = 10;
/** Containers are also re-listed this often, in case an event was missed. */
const RECONCILE_MS = 30_000;
const LEASE_MS = 30_000;
const RENEW_MS = 10_000;
const SYNC_MS = 30_000;
const SOURCE_STATE_TTL_S = 24 * 3600;

const leaseKey = (serverId: string) => `logs:lease:${serverId}`;

interface Conn {
  ssh: SshSession;
  channels: number;
  /** sshd refused another channel on it. */
  full: boolean;
}

interface Follower {
  follow: Follow | null;
  conn: Conn | null;
}

interface ServiceRef {
  id: string;
  organizationId: string;
  environmentId: string;
}

/** One server: its SSH connections, a follower per running container and one per readable server source. */
class ServerCollector {
  private conns: Conn[] = [];
  private readonly followers = new Map<string, Follower>();
  private readonly sources = new Map<FollowedSource, Follower>();
  private organizationId = "";
  private stopped = false;
  private reconcileTimer: NodeJS.Timeout | null = null;
  private reconciling: Promise<void> | null = null;
  private again = false;
  private wake: (() => void) | null = null;
  /** How to open another connection to this server (set once connected). */
  private target: (() => ReturnType<typeof sshTargetFor>) | null = null;

  constructor(
    private readonly serverId: string,
    private readonly sink: LogSink,
    private readonly serverSink: ServerLogSink,
  ) {}

  /** Connect, follow, and on a drop reconnect with a growing pause (15 s → 5 min). */
  async run(): Promise<void> {
    let pause = 15_000;
    while (!this.stopped) {
      const started = Date.now();
      try {
        await this.session();
      } catch (e) {
        if (!this.stopped) log.warn(`logs: server ${this.serverId}: ${(e as Error).message}`);
      }
      this.teardown();
      if (this.stopped) return;
      if (Date.now() - started > 60_000) pause = 15_000;
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, pause);
        this.wake = () => {
          clearTimeout(t);
          resolve();
        };
      });
      this.wake = null;
      pause = Math.min(pause * 2, 5 * 60_000);
    }
  }

  stop(): void {
    this.stopped = true;
    this.teardown();
    this.wake?.();
  }

  /** One connected stretch: ends when the first connection drops. */
  private async session(): Promise<void> {
    const server = await prisma.server.findUnique({
      where: { id: this.serverId },
      include: { serverSshKey: { select: { privateKeyEncrypted: true } } },
    });
    if (!server) throw new Error("deleted");
    this.organizationId = server.organizationId;
    const control: Conn = { ssh: await openSsh(await sshTargetFor(server)), channels: 1, full: false };
    this.conns = [control];
    this.target = () => sshTargetFor(server);
    // A Warden container starting: follow it now rather than at the next re-list.
    const events = new LineSplitter();
    const ev = await control.ssh.follow(
      EVENTS_COMMAND,
      (d) => {
        if (events.push(d).length) this.scheduleReconcile(300);
      },
      () => {},
    );
    this.scheduleReconcile(0);
    // Ends on the first of: the connection dropping, `docker events` ending (no Docker), stop().
    const why = await Promise.race([control.ssh.closed.then((e) => e?.message ?? "connection closed"), ev.done.then(() => "docker events stopped")]);
    if (!this.stopped) throw new Error(why);
  }

  private teardown(): void {
    if (this.reconcileTimer) clearTimeout(this.reconcileTimer);
    this.reconcileTimer = null;
    for (const f of this.followers.values()) f.follow?.stop();
    this.followers.clear();
    for (const f of this.sources.values()) f.follow?.stop();
    this.sources.clear();
    for (const c of this.conns) c.ssh.close();
    this.conns = [];
  }

  private scheduleReconcile(ms: number): void {
    if (this.stopped || !this.conns.length) return;
    if (this.reconcileTimer) clearTimeout(this.reconcileTimer);
    this.reconcileTimer = setTimeout(() => {
      this.reconcileTimer = null;
      void this.reconcile();
    }, ms);
  }

  /** Re-list the containers and follow any that aren't followed yet. One at a time. */
  private async reconcile(): Promise<void> {
    if (this.reconciling) {
      this.again = true;
      return this.reconciling;
    }
    this.reconciling = (async () => {
      try {
        const control = this.conns[0];
        if (!control) return;
        await this.reconcileSources(control);
        const out = await control.ssh.run(LIST_COMMAND);
        if (out.code !== 0) throw new Error(out.stderr.trim().split("\n")[0] || "docker ps failed");
        const fresh = parseContainerList(out.stdout).filter((c) => !this.followers.has(c.id));
        if (!fresh.length) return;
        // Only services of this server's org: a label is just text on a container.
        const server = await prisma.server.findUnique({ where: { id: this.serverId }, select: { organizationId: true } });
        if (!server) return;
        const services = await prisma.service.findMany({
          where: { id: { in: [...new Set(fresh.map((c) => c.serviceId))] }, organizationId: server.organizationId },
          select: { id: true, organizationId: true, environmentId: true },
        });
        const byId = new Map(services.map((s) => [s.id, s]));
        for (const c of fresh) {
          const s = byId.get(c.serviceId);
          if (s && !this.stopped) await this.startFollower(c, s);
        }
      } catch (e) {
        if (!this.stopped) log.warn(`logs: server ${this.serverId}: couldn't list containers: ${(e as Error).message}`);
      } finally {
        this.reconciling = null;
        if (!this.stopped) {
          if (this.again) {
            this.again = false;
            this.scheduleReconcile(0);
          } else this.scheduleReconcile(RECONCILE_MS);
        }
      }
    })();
    return this.reconciling;
  }

  private async startFollower(c: RunningContainer, s: ServiceRef): Promise<void> {
    const f: Follower = { follow: null, conn: null };
    this.followers.set(c.id, f);
    try {
      const since = (await redis.get(cursorKey(c.id))) ?? null;
      const masker = await maskerFor(s);
      const cmd = followCommand(c.id, since);
      const handler = (stream: LogStream) => {
        const split = new LineSplitter();
        return (d: Buffer) => {
          for (const raw of split.push(d)) {
            const p = parseLogLine(raw);
            // No timestamp = the docker CLI's own message, not the app's.
            if (!p) continue;
            // --since repeats the cursor's line; anything at or before it is saved already.
            // Compared with the START cursor only: stdout and stderr arrive on their own
            // streams, so a stderr line can come in after a newer stdout line.
            if (since && p.ts <= since) continue;
            this.sink.offer({
              organizationId: s.organizationId,
              serviceId: s.id,
              deploymentId: c.deploymentId,
              stream,
              ts: p.ts,
              message: masker.mask(cleanLine(p.text)),
              containerId: c.id,
            });
          }
        };
      };
      const { follow, conn } = await this.openFollow(cmd, handler("STDOUT"), handler("STDERR"));
      if (this.stopped || this.followers.get(c.id) !== f) {
        follow.stop();
        conn.channels--;
        return;
      }
      f.follow = follow;
      f.conn = conn;
      void follow.done.then(() => {
        conn.channels--;
        if (this.followers.get(c.id) === f) this.followers.delete(c.id);
        // It stopped (or restarted, or its connection dropped): re-list soon.
        this.scheduleReconcile(2000);
      });
    } catch (e) {
      if (this.followers.get(c.id) === f) this.followers.delete(c.id);
      if (!this.stopped) log.warn(`logs: couldn't follow container ${c.id.slice(0, 12)}: ${(e as Error).message}`);
    }
  }

  /** What this server lets us read (saved for the server page), then follow each readable source that isn't followed yet. */
  private async reconcileSources(control: Conn): Promise<void> {
    const probe = await control.ssh.run(PROBE_COMMAND);
    const { states, relogin } = parseProbe(probe.stdout);
    if (relogin) {
      // Groups only change on a new SSH login: reconnect (every follower resumes from its cursor).
      log.info(`logs: server ${this.serverId}: the SSH user can read the journal now, reconnecting`);
      control.ssh.close();
      return;
    }
    await redis.multi().hset(serverSourcesKey(this.serverId), states).expire(serverSourcesKey(this.serverId), SOURCE_STATE_TTL_S).exec();
    for (const source of FOLLOWED_SOURCES) {
      if (states[source] === "ok" && !this.sources.has(source) && !this.stopped) await this.startSourceFollower(source);
    }
  }

  private async startSourceFollower(source: FollowedSource): Promise<void> {
    const f: Follower = { follow: null, conn: null };
    this.sources.set(source, f);
    const key = serverCursorKey(this.serverId, source);
    try {
      const saved = await redis.get(key);
      const base = { organizationId: this.organizationId, serverId: this.serverId, source };
      let cmd: string;
      let onOut: (d: Buffer) => void;
      let onErr: (d: Buffer) => void;
      let errText = "";
      if (source === "TRAEFIK") {
        const since = saved && normalizeTs(saved) ? saved : null;
        cmd = traefikFollowCommand(since);
        const handler = () => {
          const split = new LineSplitter();
          return (d: Buffer) => {
            for (const raw of split.push(d)) {
              const p = parseLogLine(raw);
              // Lines at or before the start cursor are saved already (see startFollower).
              if (!p || (since && p.ts <= since)) continue;
              this.serverSink.offer({ ...base, ts: p.ts, message: cleanLine(p.text), cursor: p.ts });
            }
          };
        };
        onOut = handler();
        onErr = handler();
      } else {
        cmd = journalFollowCommand(source, saved);
        const split = new LineSplitter();
        onOut = (d) => {
          for (const raw of split.push(d)) {
            const e = parseJournalLine(raw, source);
            if (e) this.serverSink.offer({ ...base, ts: e.ts, message: cleanLine(e.text), cursor: e.cursor });
          }
        };
        onErr = (d) => {
          errText = (errText + d.toString()).slice(-2000);
        };
      }
      const { follow, conn } = await this.openFollow(cmd, onOut, onErr);
      if (this.stopped || this.sources.get(source) !== f) {
        follow.stop();
        conn.channels--;
        return;
      }
      f.follow = follow;
      f.conn = conn;
      void follow.done.then(async () => {
        conn.channels--;
        if (this.sources.get(source) === f) this.sources.delete(source);
        // The journal was rotated or vacuumed past our position: start again from its last entries.
        if (/cursor/i.test(errText)) await redis.del(key).catch(() => 0);
        // Traefik recreated (Update proxy), or the journal command ended: look again soon.
        this.scheduleReconcile(5000);
      });
    } catch (e) {
      if (this.sources.get(source) === f) this.sources.delete(source);
      if (!this.stopped) log.warn(`logs: server ${this.serverId}: couldn't follow ${source.toLowerCase()} logs: ${(e as Error).message}`);
    }
  }

  /** A channel on a connection with room, opening another connection when they're all full. */
  private async openFollow(cmd: string, onOut: (d: Buffer) => void, onErr: (d: Buffer) => void): Promise<{ follow: Follow; conn: Conn }> {
    for (;;) {
      let conn = this.conns.find((c) => !c.full && c.channels < CHANNELS_PER_CONNECTION);
      if (!conn) {
        if (this.conns.length >= MAX_CONNECTIONS || !this.target) throw new Error("too many containers to follow on this server");
        conn = { ssh: await openSsh(await this.target()), channels: 0, full: false };
        this.conns.push(conn);
        const added = conn;
        void added.ssh.closed.then(() => {
          this.conns = this.conns.filter((x) => x !== added);
        });
      }
      conn.channels++;
      try {
        return { follow: await conn.ssh.follow(cmd, onOut, onErr), conn };
      } catch (e) {
        conn.channels--;
        if (!/open failure|open failed/i.test((e as Error).message)) throw e;
        conn.full = true; // sshd's MaxSessions is lower than ours: try the next connection
      }
    }
  }
}

/**
 * Runs a ServerCollector for every server (apps' logs and the server's own), holding
 * a Redis lease per server so two workers never collect the same server.
 */
export class LogCollectors {
  private readonly id = randomUUID();
  private readonly running = new Map<string, ServerCollector>();
  private readonly sink = new LogSink();
  private readonly serverSink = new ServerLogSink();
  private syncTimer: NodeJS.Timeout | null = null;
  private renewTimer: NodeJS.Timeout | null = null;

  start(): void {
    void this.sync();
    this.syncTimer = setInterval(() => void this.sync(), SYNC_MS);
    this.renewTimer = setInterval(() => void this.renew(), RENEW_MS);
  }

  private async sync(): Promise<void> {
    try {
      const servers = await prisma.server.findMany({ select: { id: true } });
      const wanted = new Set(servers.map((s) => s.id));
      for (const [id, c] of this.running) {
        if (!wanted.has(id)) {
          c.stop();
          this.running.delete(id);
          await this.release(id);
        }
      }
      for (const id of wanted) {
        if (this.running.has(id)) continue;
        const got = await redis.set(leaseKey(id), this.id, "PX", LEASE_MS, "NX");
        if (got !== "OK") continue; // another worker has it
        const c = new ServerCollector(id, this.sink, this.serverSink);
        this.running.set(id, c);
        void c.run();
      }
    } catch (e) {
      log.warn(`logs: couldn't read the server list: ${(e as Error).message}`);
    }
  }

  /** Keep our leases alive; a lease we lost (Redis restart, a long pause) means another worker may have it, so stop. */
  private async renew(): Promise<void> {
    for (const [id, c] of this.running) {
      const ok = await redis.eval(RENEW_SCRIPT, 1, leaseKey(id), this.id, String(LEASE_MS)).catch(() => 0);
      if (ok !== 1) {
        c.stop();
        this.running.delete(id);
      }
    }
  }

  private async release(serverId: string): Promise<void> {
    await redis.eval(RELEASE_SCRIPT, 1, leaseKey(serverId), this.id).catch(() => 0);
  }

  async stop(): Promise<void> {
    if (this.syncTimer) clearInterval(this.syncTimer);
    if (this.renewTimer) clearInterval(this.renewTimer);
    for (const [id, c] of this.running) {
      c.stop();
      await this.release(id);
    }
    this.running.clear();
    await Promise.all([this.sink.close(), this.serverSink.close()]);
  }
}

// Only the worker holding the lease may extend or drop it.
const RENEW_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("pexpire", KEYS[1], ARGV[2]) else return 0 end`;
const RELEASE_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
