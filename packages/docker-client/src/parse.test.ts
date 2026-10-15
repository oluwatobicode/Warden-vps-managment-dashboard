import { describe, expect, it } from "vitest";
import { parseContainers, parseReclaimed, parseSize, parseStats, parseSystemDf, parseContainerSize } from "./parse";

// Sample output in the shapes the Docker CLI prints (docker 24–27).
const PS = [
  '{"Command":"\\"/docker-entrypoint.…\\"","CreatedAt":"2026-10-14 09:12:01 +0000 UTC","ID":"a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90","Image":"argus-api:7f3c2a1","Names":"argus-api","Ports":"0.0.0.0:8080->8080/tcp","RunningFor":"3 hours ago","State":"running","Status":"Up 3 hours (healthy)"}',
  '{"ID":"b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1","Image":"postgres:16","Names":"argus-postgres,db-alias","State":"running","Status":"Up 2 days (health: starting)"}',
  '{"ID":"c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2","Image":"argus-ingest:old","Names":"argus-ingest","State":"exited","Status":"Exited (1) 5 minutes ago"}',
  "WARNING: something the daemon printed",
  // Docker before 23 printed no State field
  '{"ID":"d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3","Image":"redis:7","Names":"redis-cache","Status":"Restarting (1) 3 seconds ago"}',
].join("\n");

const STATS = [
  '{"BlockIO":"0B / 0B","CPUPerc":"12.34%","Container":"a1b2c3d4e5f6","ID":"a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90","MemPerc":"6.12%","MemUsage":"120.5MiB / 1.944GiB","Name":"argus-api","NetIO":"1kB / 2kB","PIDs":"12"}',
  '{"CPUPerc":"--","ID":"b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1","MemUsage":"-- / --","Name":"argus-postgres"}',
].join("\n");

const SYSTEM_DF = [
  '{"Active":"3","Reclaimable":"1.2GB (50%)","Size":"2.4GB","TotalCount":"6","Type":"Images"}',
  '{"Active":"2","Reclaimable":"10.5kB (1%)","Size":"1.05MB","TotalCount":"3","Type":"Containers"}',
  '{"Active":"1","Reclaimable":"0B (0%)","Size":"500MB","TotalCount":"1","Type":"Local Volumes"}',
  '{"Active":"0","Reclaimable":"350MB","Size":"350MB","TotalCount":"14","Type":"Build Cache"}',
].join("\n");

describe("parseSize", () => {
  it.each([
    ["0B", 0],
    ["512kB", 512_000],
    ["1.2GB", 1_200_000_000],
    ["1.2GB (50%)", 1_200_000_000],
    ["3.9MiB", Math.round(3.9 * 1024 ** 2)],
    ["1.944GiB", Math.round(1.944 * 1024 ** 3)],
    [" 120 MB ", 120_000_000],
    ["--", 0],
    ["", 0],
  ])("%s → %d bytes", (text, bytes) => expect(parseSize(text)).toBe(bytes));
});

describe("parseContainers", () => {
  const list = parseContainers(PS);

  it("reads every JSON line and skips the rest", () => {
    expect(list.map((c) => c.name)).toEqual(["argus-api", "argus-postgres", "argus-ingest", "redis-cache"]);
  });

  it("keeps the full id, the first name and the image", () => {
    expect(list[0].id).toHaveLength(64);
    expect(list[1].name).toBe("argus-postgres");
    expect(list[1].image).toBe("postgres:16");
  });

  it("reads health from the status text", () => {
    expect(list.map((c) => c.health)).toEqual(["healthy", "starting", null, null]);
  });

  it("works out the state when Docker didn't send one", () => {
    expect(list.map((c) => c.state)).toEqual(["running", "running", "exited", "restarting"]);
  });
});

describe("parseStats", () => {
  const stats = parseStats(STATS);

  it("reads CPU % and memory used / limit in bytes", () => {
    const s = stats.get("a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90");
    expect(s).toEqual({ cpu: 12.34, memoryBytes: Math.round(120.5 * 1024 ** 2), memoryLimitBytes: Math.round(1.944 * 1024 ** 3) });
  });

  it("gives nulls for a container that has no numbers yet", () => {
    expect(stats.get("b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1")).toEqual({ cpu: null, memoryBytes: null, memoryLimitBytes: null });
  });
});

describe("parseSystemDf", () => {
  it("splits Docker's disk use by type and adds up the reclaimable space", () => {
    expect(parseSystemDf(SYSTEM_DF)).toEqual({
      images: 2_400_000_000,
      containers: 1_050_000,
      volumes: 500_000_000,
      buildCache: 350_000_000,
      total: 2_400_000_000 + 1_050_000 + 500_000_000 + 350_000_000,
      reclaimable: 1_200_000_000 + 10_500 + 350_000_000,
      buildCacheReclaimable: 350_000_000,
    });
  });

  it("is all zeros for an empty Docker", () => {
    expect(parseSystemDf("").total).toBe(0);
  });
});

describe("prune output", () => {
  it("reads the reclaimed total", () => {
    expect(parseReclaimed("Deleted Containers:\nabc123\n\nTotal reclaimed space: 1.5GB\n")).toBe(1_500_000_000);
    expect(parseReclaimed("Total reclaimed space: 0B")).toBe(0);
    expect(parseReclaimed("Deleted Networks:\nold_net\n")).toBe(0);
  });

  it("takes the writable size, not the virtual one", () => {
    expect(parseContainerSize("12.3kB (virtual 100MB)")).toBe(12_300);
  });
});
