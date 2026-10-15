import { describe, expect, it } from "vitest";
import { cleanupPreview, listContainers, runCleanup } from "./docker";
import { DockerError, type Run } from "./run";

/** A fake server: answers known commands, records what was run. */
function fakeRun(answers: Record<string, { code?: number; stdout?: string; stderr?: string }>) {
  const ran: string[] = [];
  const run: Run = async (cmd) => {
    ran.push(cmd);
    const prefix = Object.keys(answers).find((k) => cmd.startsWith(k));
    const a = prefix ? answers[prefix] : { code: 1, stderr: `unexpected: ${cmd}` };
    return { code: a.code ?? 0, stdout: a.stdout ?? "", stderr: a.stderr ?? "" };
  };
  return { run, ran };
}

describe("listContainers", () => {
  it("skips docker stats when nothing is running", async () => {
    const { run, ran } = fakeRun({ "docker ps": { stdout: '{"ID":"x1","Names":"old","Image":"i","State":"exited","Status":"Exited (0) 1 day ago"}' } });
    const list = await listContainers(run);
    expect(list).toHaveLength(1);
    expect(list[0].cpu).toBeNull();
    expect(ran.some((c) => c.startsWith("docker stats"))).toBe(false);
  });

  it("explains a missing docker and a missing permission", async () => {
    const missing = fakeRun({ "docker ps": { code: 127, stderr: "bash: docker: command not found" } });
    await expect(listContainers(missing.run)).rejects.toMatchObject({ kind: "not_installed" });
    const denied = fakeRun({ "docker ps": { code: 1, stderr: "permission denied while trying to connect to the Docker daemon socket" } });
    await expect(listContainers(denied.run)).rejects.toBeInstanceOf(DockerError);
    await expect(listContainers(denied.run)).rejects.toMatchObject({ kind: "permission_denied" });
  });
});

describe("cleanupPreview", () => {
  it("adds up what would be freed, per category", async () => {
    const { run } = fakeRun({
      "docker ps -a -s": { stdout: '{"ID":"s1","Size":"10MB (virtual 1GB)"}\n{"ID":"s2","Size":"5MB (virtual 1GB)"}' },
      "docker images -f dangling=true": { stdout: '{"ID":"i1","Size":"200MB"}' },
      "docker system df": { stdout: '{"Type":"Build Cache","Size":"1GB","Reclaimable":"300MB"}' },
      "docker network ls": { stdout: "old_net\nother_net\n" },
    });
    const p = await cleanupPreview(run);
    expect(p.categories).toEqual([
      { key: "containers", count: 2, bytes: 15_000_000 },
      { key: "images", count: 1, bytes: 200_000_000 },
      { key: "buildCache", count: 1, bytes: 300_000_000 },
      { key: "networks", count: 2, bytes: null },
    ]);
    expect(p.totalBytes).toBe(515_000_000);
  });
});

describe("runCleanup", () => {
  it("never prunes volumes or every image", async () => {
    const { run, ran } = fakeRun({ "docker ": { stdout: "Total reclaimed space: 1MB" } });
    await runCleanup(run);
    expect(ran.join("\n")).not.toMatch(/volume prune|prune -a|prune --all/);
  });

  it("sums what each step freed", async () => {
    const { run } = fakeRun({ "docker ": { stdout: "Total reclaimed space: 1MB" } });
    expect(await runCleanup(run)).toEqual({ reclaimedBytes: 4_000_000, failed: null });
  });

  it("stops at the first failure and keeps what was freed before it", async () => {
    const { run, ran } = fakeRun({
      "docker container prune": { stdout: "Total reclaimed space: 2MB" },
      "docker image prune": { code: 1, stderr: "Error response from daemon: a prune operation is already running" },
    });
    const r = await runCleanup(run);
    expect(r).toEqual({ reclaimedBytes: 2_000_000, failed: { key: "images", message: "Error response from daemon: a prune operation is already running" } });
    expect(ran).toHaveLength(2);
  });
});
