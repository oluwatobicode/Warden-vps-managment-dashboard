import { describe, expect, it } from "vitest";
import { cpuPercent, cpuTicks, memory, parseHost, percentOf, splitSections, HOST_COMMAND } from "./host";

// Shaped like real Linux output (/proc/stat, /proc/loadavg, /proc/meminfo, df -B1).
const MEMINFO = `MemTotal:        2014528 kB
MemFree:          120000 kB
MemAvailable:    1007264 kB
Buffers:           50000 kB
Cached:           600000 kB
SwapCached:            0 kB
`;
const SAMPLE = [
  "@@stat1",
  "cpu  1000 0 500 8000 500 0 0 0 0 0",
  "@@stat2",
  "cpu  1060 0 530 8100 510 0 0 0 0 0",
  "@@loadavg",
  "0.42 0.30 0.15 2/187 12345",
  "@@meminfo",
  MEMINFO.trimEnd(),
  "@@df",
  "   10331889664   4132755865",
  "",
].join("\n");

describe("the host command", () => {
  it("marks every section the parser reads", () => {
    for (const name of ["stat1", "stat2", "loadavg", "meminfo", "df"]) expect(HOST_COMMAND).toContain(`@@${name}`);
  });
});

describe("splitSections", () => {
  it("splits stdout back into named parts", () => {
    const s = splitSections(SAMPLE);
    expect([...s.keys()]).toEqual(["stat1", "stat2", "loadavg", "meminfo", "df"]);
    expect(s.get("loadavg")?.trim()).toBe("0.42 0.30 0.15 2/187 12345");
  });
});

describe("cpu", () => {
  it("counts iowait as idle and leaves guest time out of the total", () => {
    expect(cpuTicks("cpu  100 0 50 800 50 0 0 0 30 0")).toEqual({ busy: 150, total: 1000 });
  });

  it("is busy ticks over total ticks between the two samples", () => {
    // busy +90, idle +110, total +200 → 45%
    expect(cpuPercent("cpu  1000 0 500 8000 500 0 0 0 0 0", "cpu  1060 0 530 8100 510 0 0 0 0 0")).toBe(45);
  });

  it("is 0 rather than nonsense when the samples are unusable", () => {
    expect(cpuPercent("garbage", "cpu  1 0 0 0 0")).toBe(0);
    expect(cpuPercent("cpu  5 0 0 5 0", "cpu  5 0 0 5 0")).toBe(0);
  });
});

describe("memory", () => {
  it("is total minus available, in bytes", () => {
    expect(memory(MEMINFO)).toEqual({ totalBytes: 2014528 * 1024, usedBytes: (2014528 - 1007264) * 1024 });
  });

  it("estimates available on kernels without MemAvailable", () => {
    const old = "MemTotal: 1000 kB\nMemFree: 200 kB\nBuffers: 100 kB\nCached: 300 kB\n";
    expect(memory(old).usedBytes).toBe(400 * 1024);
  });
});

describe("parseHost", () => {
  it("reads everything from one stdout", () => {
    expect(parseHost(SAMPLE)).toEqual({
      cpuPercent: 45,
      load1: 0.42,
      load5: 0.3,
      load15: 0.15,
      memoryTotalBytes: 2014528 * 1024,
      memoryUsedBytes: (2014528 - 1007264) * 1024,
      diskTotalBytes: 10331889664,
      diskUsedBytes: 4132755865,
    });
  });

  it("refuses output that isn't from a Linux host", () => {
    expect(() => parseHost("@@stat1\nnope\n")).toThrow(/Linux/);
  });
});

describe("percentOf", () => {
  it("rounds to one decimal and never leaves 0–100", () => {
    expect(percentOf(4132755865, 10331889664)).toBe(40);
    expect(percentOf(5, 0)).toBe(0);
    expect(percentOf(150, 100)).toBe(100);
  });
});
