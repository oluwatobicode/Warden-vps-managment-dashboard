import { describe, expect, it } from "vitest";
import { journalFollowCommand, parseJournalLine, parseProbe, traefikFollowCommand } from "./server-lines";

const CURSOR = "s=0d6f6b0c;i=1a2b;b=9f8e;m=3c4d;t=5e6f;x=7a8b";

describe("parseProbe", () => {
  it("reads each source's state", () => {
    expect(parseProbe("journal=ok\ntraefik=ok\n")).toEqual({ states: { TRAEFIK: "ok", DOCKER: "ok", SYSTEM: "ok" }, relogin: false });
    expect(parseProbe("journal=denied\ntraefik=missing\n").states).toEqual({ TRAEFIK: "missing", DOCKER: "no-permission", SYSTEM: "no-permission" });
    expect(parseProbe("journal=none\ntraefik=ok\n").states).toMatchObject({ DOCKER: "no-journal", SYSTEM: "no-journal" });
  });
  it("asks for a new login when the user was added to the group after this one", () => {
    expect(parseProbe("journal=relogin\ntraefik=ok\n")).toEqual({ states: { TRAEFIK: "ok", DOCKER: "no-permission", SYSTEM: "no-permission" }, relogin: true });
  });
  it("says unknown when the output is something else", () => {
    expect(parseProbe("sh: oops").states).toEqual({ TRAEFIK: "unknown", DOCKER: "unknown", SYSTEM: "unknown" });
  });
});

describe("follow commands", () => {
  it("Traefik: from the cursor, or the last 200 lines", () => {
    expect(traefikFollowCommand("2026-11-01T10:00:00.000000000Z")).toContain("docker logs -f -t --since 2026-11-01T10:00:00.000000000Z warden-traefik");
    expect(traefikFollowCommand(null)).toContain("--tail 200 warden-traefik");
    expect(() => traefikFollowCommand("now; rm -rf /")).toThrow();
  });
  it("journal: after the cursor (quoted), or the last 200 entries; ends with the channel", () => {
    const docker = journalFollowCommand("DOCKER", CURSOR);
    expect(docker).toContain("journalctl -u docker.service -f");
    expect(docker).toContain(`--after-cursor '${CURSOR}'`);
    expect(journalFollowCommand("SYSTEM", null)).toContain("-p warning");
    expect(journalFollowCommand("SYSTEM", null)).toContain("-n 200");
    expect(docker).toMatch(/^exec 3<&0; \(cat <&3 .*kill 0\)/);
  });
  it("refuses a cursor that could break out of the quotes", () => {
    expect(() => journalFollowCommand("DOCKER", "x'; reboot; '")).toThrow();
  });
});

describe("parseJournalLine", () => {
  const entry = (o: Record<string, unknown>) =>
    JSON.stringify({ __CURSOR: CURSOR, __REALTIME_TIMESTAMP: "1793527200123456", MESSAGE: "hello", ...o });

  it("turns the microsecond timestamp into a normalized one", () => {
    expect(parseJournalLine(entry({}), "DOCKER")).toEqual({ ts: "2026-11-01T10:00:00.123456000Z", text: "hello", cursor: CURSOR });
  });
  it("names the program for system lines", () => {
    expect(parseJournalLine(entry({ SYSLOG_IDENTIFIER: "kernel", MESSAGE: "Out of memory: Killed process 4242" }), "SYSTEM")?.text).toBe("kernel: Out of memory: Killed process 4242");
  });
  it("leaves Docker's own lines to the DOCKER source", () => {
    expect(parseJournalLine(entry({ _SYSTEMD_UNIT: "docker.service" }), "SYSTEM")).toBeNull();
    expect(parseJournalLine(entry({ _SYSTEMD_UNIT: "docker.service" }), "DOCKER")).not.toBeNull();
  });
  it("decodes a message sent as bytes, and skips what isn't an entry", () => {
    expect(parseJournalLine(entry({ MESSAGE: [104, 105] }), "DOCKER")?.text).toBe("hi");
    expect(parseJournalLine("-- No entries --", "DOCKER")).toBeNull();
    expect(parseJournalLine(JSON.stringify({ MESSAGE: "no cursor" }), "DOCKER")).toBeNull();
  });
});
