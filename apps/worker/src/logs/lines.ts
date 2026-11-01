import { LOG_LIMITS } from "shared-types";

/*
 * The pure parts of the log collector: commands, parsing `docker logs -t`
 * output, cleaning and masking lines, the per-service rate limit. Tested.
 */

const CONTAINER_ID = /^[0-9a-f]{12,64}$/;
/** Docker's RFC 3339 timestamp, as `docker logs -t` prints it. */
const DOCKER_TS = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/;

/**
 * Docker trims trailing zeros (".5Z", ".123456789Z"), so its timestamps don't
 * sort as text. This pads them to 9 digits, which does: the cursor compares
 * them as strings. Null if it isn't one.
 */
export function normalizeTs(ts: string): string | null {
  const m = DOCKER_TS.exec(ts);
  return m ? `${m[1]}.${(m[2] ?? "").padEnd(9, "0")}Z` : null;
}

/**
 * Runs `cmd` so that it ends when the SSH channel closes. sshd doesn't kill a
 * command when the channel goes away, it only closes its stdin; without this,
 * every reconnect would leave a `docker logs -f` running on the server. The
 * watchdog waits for stdin to close, then kills the command's process group.
 */
export function untilChannelCloses(cmd: string): string {
  return `exec 3<&0; (cat <&3 >/dev/null 2>&1; kill 0) >/dev/null 2>&1 & ${cmd}`;
}

/**
 * Follow one container's log from `since` (a normalized timestamp: lines at
 * or after it), or its last 1,000 lines the first time it's seen.
 */
export function followCommand(containerId: string, since: string | null): string {
  if (!CONTAINER_ID.test(containerId)) throw new Error(`unsafe container id: ${containerId}`);
  if (since !== null && !normalizeTs(since)) throw new Error(`bad timestamp: ${since}`);
  const from = since ? `--since ${since}` : "--tail 1000";
  return untilChannelCloses(`exec docker logs -f -t ${from} ${containerId}`);
}

/** Warden's running containers: id, service id, deployment id (tab-separated). */
export const LIST_COMMAND = `docker ps --no-trunc --filter label=warden.service --format '{{.ID}}\t{{.Label "warden.service"}}\t{{.Label "warden.deployment"}}'`;

/** One line per Warden container starting, so a new deploy's logs are followed at once. */
export const EVENTS_COMMAND = untilChannelCloses(
  "exec docker events --filter type=container --filter label=warden.service --filter event=start --format '{{.Actor.ID}}'",
);

export interface RunningContainer {
  id: string;
  serviceId: string;
  deploymentId: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseContainerList(stdout: string): RunningContainer[] {
  const out: RunningContainer[] = [];
  for (const line of stdout.split("\n")) {
    const [id, serviceId, deploymentId] = line.trim().split("\t");
    if (!id || !CONTAINER_ID.test(id) || !serviceId || !UUID.test(serviceId)) continue;
    out.push({ id, serviceId, deploymentId: deploymentId && UUID.test(deploymentId) ? deploymentId : null });
  }
  return out;
}

/**
 * Bytes in, whole lines out. A line that never ends (a progress bar with no
 * newline) is let out once it's past the line limit, so memory stays bounded.
 */
export class LineSplitter {
  private rest = "";

  push(chunk: Buffer | string): string[] {
    const text = this.rest + chunk.toString();
    const lines = text.split("\n");
    this.rest = lines.pop() ?? "";
    if (this.rest.length > LOG_LIMITS.lineChars * 2) {
      lines.push(this.rest);
      this.rest = "";
    }
    return lines;
  }
}

/** "2026-10-28T20:01:02.5Z hello" → its normalized time and text. */
export function parseLogLine(line: string): { ts: string; text: string } | null {
  const space = line.indexOf(" ");
  const ts = normalizeTs(space < 0 ? line : line.slice(0, space));
  return ts ? { ts, text: space < 0 ? "" : line.slice(space + 1) } : null;
}

// Colour and cursor codes (CSI ... letter, OSC ... BEL/ST, and lone ESC x).
const ANSI = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g;
// Control characters other than tab.
const CONTROL = /[\x00-\x08\x0b-\x1f\x7f]/g;

/** What's saved: no colour codes (search matches what you see), no stray \r, at most the line limit. */
export function cleanLine(text: string): string {
  const plain = text.replace(ANSI, "").replace(CONTROL, "");
  return plain.length > LOG_LIMITS.lineChars ? `${plain.slice(0, LOG_LIMITS.lineChars)}…[cut]` : plain;
}

const MASK = "••••••";
/** Shorter values ("true", "3000") would mask ordinary words and numbers. */
const MIN_SECRET = 8;

/**
 * Replaces a service's secret values with ••••••, before a line is saved or
 * sent. Catches the common case (printing a variable, or a URL holding a
 * password); not a value split across lines or encoded some other way.
 */
export class Masker {
  private readonly secrets: string[];

  constructor(values: string[]) {
    const all = new Set<string>();
    for (const v of values) {
      if (v.length < MIN_SECRET) continue;
      all.add(v);
      // How a password appears inside a connection URL.
      const encoded = encodeURIComponent(v);
      if (encoded !== v) all.add(encoded);
    }
    // Longest first, so a secret containing another is masked whole.
    this.secrets = [...all].sort((a, b) => b.length - a.length);
  }

  mask(text: string): string {
    let out = text;
    for (const s of this.secrets) if (out.includes(s)) out = out.split(s).join(MASK);
    return out;
  }
}

/**
 * At most `perSecond` lines per service each second; the rest are counted,
 * and `takeDropped` reports them at most every 10 s, so a flood becomes one
 * "N lines dropped" line instead of thousands of rows.
 */
export class RateLimit {
  private second = 0;
  private used = 0;
  private dropped = 0;
  private lastReport = 0;

  constructor(readonly perSecond: number = LOG_LIMITS.linesPerSecond) {}

  allow(nowMs: number): boolean {
    const second = Math.floor(nowMs / 1000);
    if (second !== this.second) {
      this.second = second;
      this.used = 0;
    }
    if (this.used < this.perSecond) {
      this.used++;
      return true;
    }
    this.dropped++;
    return false;
  }

  /** `force`: report now whatever the time (the worker is stopping). */
  takeDropped(nowMs: number, force = false): number {
    if (!this.dropped || (!force && nowMs - this.lastReport < 10_000)) return 0;
    const n = this.dropped;
    this.dropped = 0;
    this.lastReport = nowMs;
    return n;
  }
}
