/*
 * Host CPU, memory, disk and load, read from /proc and df in ONE command so a
 * poll costs one round trip. Linux only. Parsing is pure and tested.
 */

/** Sections are marked "@@name" so one stdout can be split back apart. */
export const HOST_COMMAND = [
  "printf '@@stat1\\n'; head -1 /proc/stat",
  "sleep 1",
  "printf '@@stat2\\n'; head -1 /proc/stat",
  "printf '@@loadavg\\n'; cat /proc/loadavg",
  "printf '@@meminfo\\n'; cat /proc/meminfo",
  "printf '@@df\\n'; df -B1 --output=size,used / | tail -1",
].join("; ");

export interface HostMetrics {
  cpuPercent: number;
  load1: number;
  load5: number;
  load15: number;
  memoryTotalBytes: number;
  memoryUsedBytes: number;
  diskTotalBytes: number;
  diskUsedBytes: number;
}

export function splitSections(stdout: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of stdout.split("@@").slice(1)) {
    const nl = part.indexOf("\n");
    if (nl > 0) out.set(part.slice(0, nl).trim(), part.slice(nl + 1));
  }
  return out;
}

/** "cpu  user nice system idle iowait irq softirq steal guest guest_nice" → busy and total ticks. */
export function cpuTicks(line: string): { busy: number; total: number } | null {
  const f = line.trim().split(/\s+/);
  if (f[0] !== "cpu" || f.length < 5) return null;
  const n = f.slice(1, 9).map(Number); // guest/guest_nice are already inside user/nice
  if (n.some((x) => !Number.isFinite(x))) return null;
  const total = n.reduce((a, b) => a + b, 0);
  const idle = n[3] + (n[4] ?? 0); // idle + iowait
  return { busy: total - idle, total };
}

/** CPU % over the second between the two samples. */
export function cpuPercent(first: string, second: string): number {
  const a = cpuTicks(first);
  const b = cpuTicks(second);
  if (!a || !b || b.total <= a.total) return 0;
  return clampPercent(((b.busy - a.busy) / (b.total - a.total)) * 100);
}

/** /proc/meminfo is "Key:   1234 kB" lines. Used = total − available (cache isn't "used"). */
export function memory(meminfo: string): { totalBytes: number; usedBytes: number } {
  const kb = new Map<string, number>();
  for (const line of meminfo.split("\n")) {
    const m = /^(\w+):\s+(\d+)/.exec(line);
    if (m) kb.set(m[1], Number(m[2]));
  }
  const total = kb.get("MemTotal") ?? 0;
  // MemAvailable exists since Linux 3.14; before that, estimate it.
  const available = kb.get("MemAvailable") ?? (kb.get("MemFree") ?? 0) + (kb.get("Buffers") ?? 0) + (kb.get("Cached") ?? 0);
  return { totalBytes: total * 1024, usedBytes: Math.max(0, total - available) * 1024 };
}

export function parseHost(stdout: string): HostMetrics {
  const s = splitSections(stdout);
  const [load1 = 0, load5 = 0, load15 = 0] = (s.get("loadavg") ?? "").trim().split(/\s+/).slice(0, 3).map(Number);
  const mem = memory(s.get("meminfo") ?? "");
  const [diskTotal = 0, diskUsed = 0] = (s.get("df") ?? "").trim().split(/\s+/).map(Number);
  const host: HostMetrics = {
    cpuPercent: cpuPercent(s.get("stat1") ?? "", s.get("stat2") ?? ""),
    load1,
    load5,
    load15,
    memoryTotalBytes: mem.totalBytes,
    memoryUsedBytes: mem.usedBytes,
    diskTotalBytes: diskTotal,
    diskUsedBytes: diskUsed,
  };
  if (!host.memoryTotalBytes || !host.diskTotalBytes) {
    throw new Error("couldn't read memory or disk (is this a Linux server?)");
  }
  return host;
}

export const percentOf = (used: number, total: number) => (total > 0 ? clampPercent((used / total) * 100) : 0);

function clampPercent(n: number): number {
  return Math.round(Math.min(100, Math.max(0, n)) * 10) / 10;
}
