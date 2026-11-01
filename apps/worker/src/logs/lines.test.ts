import { describe, expect, it } from "vitest";
import { LOG_LIMITS } from "shared-types";
import { cleanLine, followCommand, LineSplitter, Masker, normalizeTs, parseContainerList, parseLogLine, RateLimit } from "./lines";

const SVC = "4a7ea0b1-1111-4222-8333-944445555666";
const DEP = "9b8c7d6e-1111-4222-8333-944445555666";
const CID = "a".repeat(64);

describe("normalizeTs", () => {
  it("pads the fraction so timestamps sort as text", () => {
    expect(normalizeTs("2026-10-28T20:01:02.5Z")).toBe("2026-10-28T20:01:02.500000000Z");
    expect(normalizeTs("2026-10-28T20:01:02Z")).toBe("2026-10-28T20:01:02.000000000Z");
    const a = normalizeTs("2026-10-28T20:01:02.5Z")!;
    const b = normalizeTs("2026-10-28T20:01:02.123456789Z")!;
    expect(b < a).toBe(true);
  });
  it("refuses anything else", () => {
    expect(normalizeTs("yesterday")).toBeNull();
    expect(normalizeTs("2026-10-28 20:01:02Z")).toBeNull();
  });
});

describe("followCommand", () => {
  it("starts from the cursor, or the last 1,000 lines the first time", () => {
    expect(followCommand(CID, "2026-10-28T20:01:02.500000000Z")).toContain(`docker logs -f -t --since 2026-10-28T20:01:02.500000000Z ${CID}`);
    expect(followCommand(CID, null)).toContain(`--tail 1000 ${CID}`);
  });
  it("ends with the channel (a watchdog on stdin)", () => {
    expect(followCommand(CID, null)).toMatch(/^exec 3<&0; \(cat <&3 .*kill 0\)/);
  });
  it("refuses anything that isn't a container id or a timestamp", () => {
    expect(() => followCommand("abc; rm -rf /", null)).toThrow(/unsafe/);
    expect(() => followCommand(CID, "now; reboot")).toThrow(/bad timestamp/);
  });
});

describe("parseContainerList", () => {
  it("reads id, service and deployment, skipping anything malformed", () => {
    const out = parseContainerList(`${CID}\t${SVC}\t${DEP}\n${"b".repeat(64)}\t${SVC}\t\nnot-a-line\n${"c".repeat(64)}\tnot-a-uuid\t\n`);
    expect(out).toEqual([
      { id: CID, serviceId: SVC, deploymentId: DEP },
      { id: "b".repeat(64), serviceId: SVC, deploymentId: null },
    ]);
  });
});

describe("LineSplitter", () => {
  it("joins lines split across chunks", () => {
    const s = new LineSplitter();
    expect(s.push("one\ntw")).toEqual(["one"]);
    expect(s.push("o\nthree\n")).toEqual(["two", "three"]);
  });
  it("lets out a line that never ends once it's too long", () => {
    const s = new LineSplitter();
    expect(s.push("x".repeat(LOG_LIMITS.lineChars * 2 + 1))).toHaveLength(1);
  });
});

describe("parseLogLine", () => {
  it("splits docker's timestamp from the text", () => {
    expect(parseLogLine("2026-10-28T20:01:02.5Z GET /health 200")).toEqual({ ts: "2026-10-28T20:01:02.500000000Z", text: "GET /health 200" });
    expect(parseLogLine("2026-10-28T20:01:02.5Z")).toEqual({ ts: "2026-10-28T20:01:02.500000000Z", text: "" });
    expect(parseLogLine("Error response from daemon: No such container")).toBeNull();
  });
});

describe("cleanLine", () => {
  it("drops colour codes and control characters, keeps tabs", () => {
    expect(cleanLine("\x1b[32minfo\x1b[39m\tready\r")).toBe("info\tready");
  });
  it("cuts very long lines", () => {
    const out = cleanLine("y".repeat(LOG_LIMITS.lineChars + 50));
    expect(out.endsWith("…[cut]")).toBe(true);
    expect(out.length).toBe(LOG_LIMITS.lineChars + "…[cut]".length);
  });
});

describe("Masker", () => {
  const m = new Masker(["s3cr3t-p@ss/word", "short", "sk_live_abcdefgh", "sk_live_abcdefgh_longer"]);
  it("masks secrets, including inside a URL", () => {
    expect(m.mask("key=sk_live_abcdefgh")).toBe("key=••••••");
    expect(m.mask("postgres://app:s3cr3t-p%40ss%2Fword@db:5432/app")).toBe("postgres://app:••••••@db:5432/app");
  });
  it("masks the longer of two overlapping secrets whole", () => {
    expect(m.mask("sk_live_abcdefgh_longer")).toBe("••••••");
  });
  it("leaves short values alone (they'd match ordinary words)", () => {
    expect(m.mask("a short line")).toBe("a short line");
  });
});

describe("RateLimit", () => {
  it("allows N a second, counts the rest, and reports them at most every 10 s", () => {
    const r = new RateLimit(2);
    const t = 1_000_000;
    expect([r.allow(t), r.allow(t + 1), r.allow(t + 2), r.allow(t + 3)]).toEqual([true, true, false, false]);
    expect(r.allow(t + 1000)).toBe(true); // a new second
    expect(r.takeDropped(t + 1000)).toBe(2);
    r.allow(t + 1001);
    r.allow(t + 1002);
    expect(r.takeDropped(t + 2000)).toBe(0); // reported less than 10 s ago
    expect(r.takeDropped(t + 11_000)).toBe(1);
    r.allow(t + 11_001);
    r.allow(t + 11_002);
    r.allow(t + 11_003);
    expect(r.takeDropped(t + 11_100, true)).toBe(1); // stopping: reported at once

  });
});
