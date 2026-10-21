import { describe, expect, it } from "vitest";
import { ensureNetwork, healthStatus, q, removeVolume, runCommand, waitHealthy, writePrivateFile, type ContainerSpec } from "./database";
import type { Run } from "./run";

function fakeRun(answer: (cmd: string, input?: string) => { code?: number; stdout?: string; stderr?: string } = () => ({})) {
  const calls: Array<{ cmd: string; input?: string }> = [];
  const run: Run = async (cmd, input) => {
    calls.push({ cmd, input });
    const a = answer(cmd, input);
    return { code: a.code ?? 0, stdout: a.stdout ?? "", stderr: a.stderr ?? "" };
  };
  return { run, calls };
}

const spec: ContainerSpec = {
  name: "warden-db-1a2b3c4d",
  image: "postgres:18",
  network: "warden-env-9f8e7d6c",
  volume: "warden-db-1a2b3c4d-data",
  dataPath: "/var/lib/postgresql",
  envFile: "/tmp/warden-1a2b3c4d.env",
  healthCmd: 'pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"',
  labels: { "warden.service": "1a2b3c4d-0000-4000-8000-000000000000" },
};

describe("q", () => {
  it("quotes for sh, including single quotes", () => {
    expect(q("a b")).toBe("'a b'");
    expect(q("it's")).toBe(`'it'"'"'s'`);
  });
});

describe("runCommand", () => {
  const cmd = runCommand(spec);
  it("never publishes a port", () => {
    expect(cmd).not.toMatch(/\s-p\s|--publish/);
  });
  it("puts the container on its network with its volume, env file and restart policy", () => {
    expect(cmd).toContain("--network 'warden-env-9f8e7d6c'");
    expect(cmd).toContain("-v 'warden-db-1a2b3c4d-data:/var/lib/postgresql'");
    expect(cmd).toContain("--env-file '/tmp/warden-1a2b3c4d.env'");
    expect(cmd).toContain("--restart unless-stopped");
  });
  it("keeps $VARS literal in the health check, so the container fills them in", () => {
    expect(cmd).toContain(`--health-cmd 'pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'`);
  });
  it("refuses unsafe names instead of running them", () => {
    expect(() => runCommand({ ...spec, name: "x; rm -rf /" })).toThrow(/unsafe container name/);
    expect(() => runCommand({ ...spec, image: "postgres:18 && curl evil" })).toThrow(/unsafe image/);
  });
});

describe("writePrivateFile", () => {
  it("sends the secret over stdin, never in the command", async () => {
    const { run, calls } = fakeRun();
    await writePrivateFile(run, "/tmp/warden-x.env", "POSTGRES_PASSWORD=s3cretXYZ\n");
    expect(calls[0].cmd).toBe("umask 077 && cat > '/tmp/warden-x.env'");
    expect(calls[0].cmd).not.toContain("s3cret");
    expect(calls[0].input).toContain("s3cretXYZ");
  });
});

describe("ensureNetwork", () => {
  it("creates the network only if it's missing", async () => {
    const { run, calls } = fakeRun();
    await ensureNetwork(run, "warden-env-9f8e7d6c");
    expect(calls[0].cmd).toBe("docker network inspect 'warden-env-9f8e7d6c' >/dev/null 2>&1 || docker network create --label warden=1 'warden-env-9f8e7d6c'");
  });
});

describe("health", () => {
  it("reads Docker's health state, and 'missing' when the container is gone", async () => {
    expect(await healthStatus(fakeRun(() => ({ stdout: "healthy\n" })).run, "warden-db-x")).toBe("healthy");
    expect(await healthStatus(fakeRun(() => ({ code: 1, stderr: "No such object" })).run, "warden-db-x")).toBe("missing");
  });
  it("waits through 'starting' and fails fast on 'unhealthy'", async () => {
    let n = 0;
    const ok = fakeRun(() => ({ stdout: ++n < 3 ? "starting" : "healthy" }));
    await waitHealthy(ok.run, "warden-db-x", { everyMs: 1 });
    expect(n).toBe(3);
    await expect(waitHealthy(fakeRun(() => ({ stdout: "unhealthy" })).run, "warden-db-x", { everyMs: 1 })).rejects.toThrow(/health check/);
  });
});

describe("removeVolume", () => {
  it("is fine when the volume is already gone", async () => {
    await expect(removeVolume(fakeRun(() => ({ code: 1, stdout: "Error: No such volume: v" })).run, "v")).resolves.toBeUndefined();
  });
});
