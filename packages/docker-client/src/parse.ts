/*
 * Pure parsers for Docker CLI output. No I/O here, so every one of them is
 * tested against sample output.
 */

const UNITS: Record<string, number> = {
  b: 1,
  kb: 1e3,
  mb: 1e6,
  gb: 1e9,
  tb: 1e12,
  pb: 1e15,
  kib: 1024,
  mib: 1024 ** 2,
  gib: 1024 ** 3,
  tib: 1024 ** 4,
  pib: 1024 ** 5,
};

/**
 * "1.2GB", "512kB", "3.9MiB", "0B", "1.2GB (50%)" → bytes. Docker writes
 * disk sizes in decimal units (kB, MB, GB) and memory in binary ones (MiB,
 * GiB), so both are understood. Anything unreadable ("--", "N/A") is 0.
 */
export function parseSize(text: string): number {
  const m = /^\s*([\d.]+)\s*([a-z]*)/i.exec(text);
  if (!m) return 0;
  const n = Number(m[1]);
  const unit = UNITS[(m[2] || "b").toLowerCase()];
  return Number.isFinite(n) && unit ? Math.round(n * unit) : 0;
}

/** "12.34%" → 12.34; "--" (not running) → null. */
export function parsePercent(text: string | undefined): number | null {
  const n = Number.parseFloat(text ?? "");
  return Number.isFinite(n) ? n : null;
}

/** `--format '{{json .}}'` prints one JSON object per line. Bad lines are skipped. */
export function jsonLines(stdout: string): Array<Record<string, string>> {
  const out: Array<Record<string, string>> = [];
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      // a warning line mixed into stdout: ignore it rather than fail the poll
    }
  }
  return out;
}

export interface DockerContainer {
  /** Full 64-character id. */
  id: string;
  name: string;
  image: string;
  state: string;
  health: "healthy" | "unhealthy" | "starting" | null;
  statusText: string;
}

/** Older Docker has no State field; work it out from the Status wording. */
function stateFrom(status: string): string {
  const s = status.toLowerCase();
  if (s.startsWith("up")) return s.includes("(paused)") ? "paused" : "running";
  if (s.startsWith("restarting")) return "restarting";
  if (s.startsWith("exited")) return "exited";
  if (s.startsWith("created")) return "created";
  if (s.startsWith("dead")) return "dead";
  if (s.startsWith("removal")) return "removing";
  return "unknown";
}

function healthFrom(status: string): DockerContainer["health"] {
  if (status.includes("(healthy)")) return "healthy";
  if (status.includes("(unhealthy)")) return "unhealthy";
  if (status.includes("(health: starting)")) return "starting";
  return null;
}

/** `docker ps -a --no-trunc --format '{{json .}}'` */
export function parseContainers(stdout: string): DockerContainer[] {
  return jsonLines(stdout)
    .filter((c) => c.ID)
    .map((c) => {
      const statusText = c.Status ?? "";
      return {
        id: c.ID,
        // A container can carry several names, comma-separated; the first is its own.
        name: (c.Names ?? "").split(",")[0] || c.ID.slice(0, 12),
        image: c.Image ?? "",
        state: (c.State || stateFrom(statusText)).toLowerCase(),
        health: healthFrom(statusText),
        statusText,
      };
    });
}

export interface ContainerStats {
  cpu: number | null;
  memoryBytes: number | null;
  memoryLimitBytes: number | null;
}

/** `docker stats --no-stream --no-trunc --format '{{json .}}'`, keyed by full id. */
export function parseStats(stdout: string): Map<string, ContainerStats> {
  const out = new Map<string, ContainerStats>();
  for (const s of jsonLines(stdout)) {
    const id = s.ID || s.Container;
    if (!id) continue;
    // "3.9MiB / 1.9GiB"; "-- / --" while a container is starting
    const [used, limit] = (s.MemUsage ?? "").split("/").map((p) => p.trim());
    const size = (t: string | undefined) => (t && t !== "--" ? parseSize(t) : null);
    out.set(id, { cpu: parsePercent(s.CPUPerc), memoryBytes: size(used), memoryLimitBytes: size(limit) });
  }
  return out;
}

export interface DockerDisk {
  images: number;
  containers: number;
  volumes: number;
  buildCache: number;
  total: number;
  reclaimable: number;
  buildCacheReclaimable: number;
}

/** `docker system df --format '{{json .}}'`: one line each for Images, Containers, Local Volumes, Build Cache. */
export function parseSystemDf(stdout: string): DockerDisk {
  const disk: DockerDisk = { images: 0, containers: 0, volumes: 0, buildCache: 0, total: 0, reclaimable: 0, buildCacheReclaimable: 0 };
  const key: Record<string, "images" | "containers" | "volumes" | "buildCache"> = {
    images: "images",
    containers: "containers",
    "local volumes": "volumes",
    "build cache": "buildCache",
  };
  for (const row of jsonLines(stdout)) {
    const k = key[(row.Type ?? "").toLowerCase()];
    if (!k) continue;
    const size = parseSize(row.Size ?? "");
    const reclaimable = parseSize(row.Reclaimable ?? "");
    disk[k] = size;
    disk.total += size;
    disk.reclaimable += reclaimable;
    if (k === "buildCache") disk.buildCacheReclaimable = reclaimable;
  }
  return disk;
}

/** The "Total reclaimed space: 1.2GB" line every prune command ends with. */
export function parseReclaimed(stdout: string): number {
  const m = /total reclaimed space:\s*(.+)/i.exec(stdout);
  return m ? parseSize(m[1]) : 0;
}

/** The first number in "12.3kB (virtual 100MB)": the writable layer a prune frees. */
export function parseContainerSize(text: string): number {
  return parseSize(text.split("(")[0] ?? "");
}
