import { describe, it, expect } from "vitest";
import { NotificationEventSchema } from "shared-types";
import { renderEvent, renderTestMessage, type EventPayloads } from "./events";

const at = new Date("2026-10-14T19:30:00Z");

const deploy = {
  organizationName: "Acme",
  projectName: "Argus",
  environmentName: "production",
  serviceName: "api",
  deploymentNumber: 42,
  branch: "main",
  commitSha: "a1b2c3d4e5f6a7b8",
  commitMessage: "Fix login redirect\n\nLonger body that must not appear",
  triggeredBy: "tobi@acme.dev",
  serverName: "warden-gcp",
  startedAt: new Date("2026-10-14T19:28:48Z"),
  finishedAt: at,
  reason: "Health check timed out after 30s",
  url: "https://warden.example/deployments/42",
};
const server = { organizationName: "Acme", serverName: "warden-gcp", serverIp: "34.1.2.3", at, lastSeenAt: new Date("2026-10-14T19:10:00Z"), reason: "Connection timed out", url: "https://warden.example/servers/1" };
const member = { organizationName: "Acme", memberName: "Ada Obi", memberEmail: "ada@acme.dev", roleLabel: "Developer", by: "Tobi", at };

const SAMPLES: EventPayloads = {
  "deploy.started": deploy,
  "deploy.succeeded": deploy,
  "deploy.failed": deploy,
  "deploy.gate_failed": deploy,
  "deploy.rolled_back": deploy,
  "deploy.cancelled": deploy,
  "server.offline": server,
  "server.recovered": server,
  "server.disk_high": { ...server, diskUsagePercent: 91.6, thresholdPercent: 85 },
  "docker.cleanup_failed": server,
  "member.joined": member,
  "member.removed": member,
};

describe("renderEvent", () => {
  it.each(NotificationEventSchema.options)("renders %s", (event) => {
    const m = renderEvent(event, SAMPLES[event] as never, { channelName: "team-email" });
    expect(m.subject.length).toBeGreaterThan(0);
    expect(m.html).toContain("<!DOCTYPE html>");
    expect(m.html).toContain(event); // footer says which event
    expect(m.html).toContain("team-email");
    expect(m.text).not.toMatch(/<[a-z]/i); // chat text has no HTML
    expect(m.preheader.length).toBeLessThanOrEqual(90);
  });

  it("escapes every value (no HTML injection through names)", () => {
    const evil = { ...deploy, serviceName: '<img src=x onerror=alert(1)>', reason: "<script>x</script>" };
    const m = renderEvent("deploy.failed", evil);
    expect(m.html).not.toContain("<img src=x");
    expect(m.html).not.toContain("<script>x");
    expect(m.html).toContain("&lt;img src=x");
  });

  it("skips rows it has no data for, and the button without a url", () => {
    const bare = { organizationName: "Acme", projectName: "Argus", environmentName: "production", serviceName: "api", deploymentNumber: 7 };
    const m = renderEvent("deploy.succeeded", bare);
    for (const label of ["Branch", "Commit", "Server", "Triggered by", "Duration"]) {
      expect(m.html).not.toContain(`>${label}<`);
      expect(m.text).not.toContain(`${label}:`);
    }
    expect(m.html).not.toContain("View deploy");
  });

  it("formats commit, duration and percentages", () => {
    const m = renderEvent("deploy.succeeded", deploy);
    expect(m.text).toContain("Commit: a1b2c3d · Fix login redirect");
    expect(m.text).not.toContain("Longer body");
    expect(m.text).toContain("Duration: 1m 12s");
    expect(m.text).toContain(deploy.url);
    expect(renderEvent("server.disk_high", SAMPLES["server.disk_high"]).subject).toBe("Disk 92% full: warden-gcp");
    expect(renderEvent("server.recovered", server).text).toContain("Down for: 20m");
  });

  it("clips very long error messages", () => {
    const m = renderEvent("deploy.failed", { ...deploy, reason: "x".repeat(5000) });
    expect(m.text).toContain("x".repeat(499) + "…");
    expect(m.text).not.toContain("x".repeat(501));
  });
});

describe("renderTestMessage", () => {
  it("keeps the short chat line and a full email", () => {
    const m = renderTestMessage({ channelName: "team-discord", organizationName: "Acme" });
    expect(m.text).toBe('✅ Test from Warden: notifications for "team-discord" are working.');
    expect(m.html).toContain("Notifications are working");
  });
});
