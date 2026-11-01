import { describe, expect, it } from "vitest";
import { proxyRunCommand, proxySetupScript } from "./traefik";

describe("proxy setup", () => {
  it("the installer script starts the same Traefik as Set up proxy", () => {
    const script = proxySetupScript();
    expect(script).toContain(proxyRunCommand());
    expect(script.startsWith("set -e\n")).toBe(true);
    expect(script).toContain("docker network create --label warden=1 'warden-proxy'");
  });
  it("publishes only 80 and 443, and keeps the status page inside the container", () => {
    const cmd = proxyRunCommand();
    expect(cmd.match(/-p \d+:\d+/g)).toEqual(["-p 80:80", "-p 443:443"]);
    expect(cmd).toContain("--entrypoints.traefik.address=127.0.0.1:8080");
  });
});
