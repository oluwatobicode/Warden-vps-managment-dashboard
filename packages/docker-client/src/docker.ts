import { docker, type Run } from "./run";
import {
  parseContainerSize,
  parseContainers,
  parseReclaimed,
  parseSize,
  parseStats,
  parseSystemDf,
  jsonLines,
  type ContainerStats,
  type DockerContainer,
  type DockerDisk,
} from "./parse";

/*
 * Everything Warden asks a server's Docker. Each function takes the `run` of
 * an open SSH session, so one session can serve a whole poll. Every command
 * is a fixed string: nothing from a user ever reaches the shell.
 */

export async function dockerVersion(run: Run): Promise<string> {
  return (await docker(run, "docker version --format '{{.Server.Version}}'")).trim();
}

/** Every container, running or not, with live CPU/memory for the running ones. */
export async function listContainers(run: Run): Promise<Array<DockerContainer & ContainerStats>> {
  const containers = parseContainers(await docker(run, "docker ps -a --no-trunc --format '{{json .}}'"));
  // `docker stats` waits ~2s to sample; skip it when nothing is running.
  const running = containers.some((c) => c.state === "running");
  const stats = running ? parseStats(await docker(run, "docker stats --no-stream --no-trunc --format '{{json .}}'")) : new Map<string, ContainerStats>();
  return containers.map((c) => ({ ...c, ...(stats.get(c.id) ?? { cpu: null, memoryBytes: null, memoryLimitBytes: null }) }));
}

export async function diskUsage(run: Run): Promise<DockerDisk> {
  return parseSystemDf(await docker(run, "docker system df --format '{{json .}}'"));
}

export type CleanupKey = "containers" | "images" | "buildCache" | "networks";

export interface CleanupPreview {
  categories: Array<{ key: CleanupKey; count: number; bytes: number | null }>;
  totalBytes: number;
}

/**
 * What a cleanup would remove, without removing anything. Sizes are upper
 * bounds: dangling images can share layers, so the real saving can be less.
 */
export async function cleanupPreview(run: Run): Promise<CleanupPreview> {
  const stopped = jsonLines(await docker(run, "docker ps -a -s -f status=exited -f status=created -f status=dead --format '{{json .}}'"));
  const dangling = jsonLines(await docker(run, "docker images -f dangling=true --format '{{json .}}'"));
  const disk = await diskUsage(run);
  const networks = (await docker(run, "docker network ls --filter dangling=true --format '{{.Name}}'")).split("\n").filter((l) => l.trim());

  const categories: CleanupPreview["categories"] = [
    { key: "containers", count: stopped.length, bytes: stopped.reduce((n, c) => n + parseContainerSize(c.Size ?? ""), 0) },
    { key: "images", count: dangling.length, bytes: dangling.reduce((n, i) => n + parseSize(i.Size ?? ""), 0) },
    { key: "buildCache", count: disk.buildCacheReclaimable > 0 ? 1 : 0, bytes: disk.buildCacheReclaimable },
    { key: "networks", count: networks.length, bytes: null },
  ];
  return { categories, totalBytes: categories.reduce((n, c) => n + (c.bytes ?? 0), 0) };
}

/**
 * The cleanup itself. Deliberately NOT included:
 *   - `image prune -a`: would delete every image not running right now,
 *     including the previous release a rollback needs.
 *   - `volume prune`: volumes hold database data; there is no undo.
 * Stops at the first failing step; what earlier steps freed still counts.
 */
export const CLEANUP_STEPS: Array<{ key: CleanupKey; cmd: string }> = [
  { key: "containers", cmd: "docker container prune -f" },
  { key: "images", cmd: "docker image prune -f" },
  { key: "buildCache", cmd: "docker builder prune -f" },
  { key: "networks", cmd: "docker network prune -f" },
];

export interface CleanupResult {
  reclaimedBytes: number;
  failed: { key: CleanupKey; message: string } | null;
}

export async function runCleanup(run: Run): Promise<CleanupResult> {
  let reclaimedBytes = 0;
  for (const step of CLEANUP_STEPS) {
    try {
      reclaimedBytes += parseReclaimed(await docker(run, step.cmd));
    } catch (e) {
      return { reclaimedBytes, failed: { key: step.key, message: (e as Error).message } };
    }
  }
  return { reclaimedBytes, failed: null };
}
