import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { EMPTY_PROXY_FORM, type ProxyForm } from "shared-types";
import { checkConfig } from "./check";
import { formToConfig } from "./form";

const form: ProxyForm = {
  forceHttps: true,
  routes: [{ domain: "old.example.com", port: 8080, https: true }],
  redirects: [{ from: "www.example.com", to: "https://example.com", keepPath: true, permanent: true, https: false }],
};

describe("formToConfig", () => {
  it("makes the routes, redirects and force-https that were proven on a real Traefik", () => {
    const c = formToConfig(form);
    const r = c.http!.routers!;
    expect(r["form-route-old-example-com"]).toMatchObject({ rule: "Host(`old.example.com`)", entryPoints: ["websecure"], tls: { certResolver: "le" } });
    expect(r["form-route-old-example-com-http"]).toMatchObject({ entryPoints: ["web"], middlewares: ["form-to-https"] });
    expect(c.http!.services!["form-route-old-example-com"]).toEqual({ loadBalancer: { servers: [{ url: "http://host.docker.internal:8080" }] } });
    expect(c.http!.middlewares!["form-redirect-www-example-com"]).toEqual({
      redirectRegex: { regex: "^https?://www\\.example\\.com(/.*)?$", replacement: "https://example.com${1}", permanent: true },
    });
    expect(r["form-force-https"]).toMatchObject({ rule: "!HostRegexp(`.+\\.sslip\\.io`)", priority: 1 });
  });

  it("an empty form makes an empty config", () => {
    expect(formToConfig(EMPTY_PROXY_FORM)).toEqual({});
  });
});

describe("checkConfig", () => {
  it("the form's own output passes Traefik's schema and the reference checks", () => {
    const r = checkConfig(form, "");
    expect(r.problems).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.yaml.startsWith("# Written by Warden")).toBe(true);
    expect(parse(r.yaml).http.routers["form-force-https"].rule).toBe("!HostRegexp(`.+\\.sslip\\.io`)");
  });

  it("free YAML is merged in; routes may point at a Warden app (@docker) or Traefik's own (@internal)", () => {
    const raw = `http:
  routers:
    blog:
      rule: Host(\`blog.example.com\`)
      service: svc-ab12cd34@docker
    status:
      rule: Host(\`status.example.com\`)
      service: noop@internal
      middlewares: [headers]
  middlewares:
    headers:
      headers:
        frameDeny: true
`;
    const r = checkConfig(form, raw);
    expect(r.problems).toEqual([]);
    const out = parse(r.yaml);
    expect(Object.keys(out.http.routers)).toEqual(expect.arrayContaining(["blog", "status", "form-force-https"]));
    expect(Object.keys(out.http.middlewares)).toEqual(expect.arrayContaining(["headers", "form-to-https"]));
  });

  it("a YAML mistake is reported on its line", () => {
    const r = checkConfig(EMPTY_PROXY_FORM, "http:\n  routers:\n    x: [\n");
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toMatchObject({ where: "raw" });
    expect(r.problems[0].line).toBeGreaterThanOrEqual(3);
    expect(r.problems[0].message).toMatch(/^YAML:/);
  });

  it("Warden's and the form's names are refused in the free YAML", () => {
    const r = checkConfig(EMPTY_PROXY_FORM, "http:\n  routers:\n    svc-123:\n      rule: Host(`a.com`)\n      service: noop@internal\n");
    expect(r.problems).toEqual([{ where: "raw", line: 3, message: expect.stringContaining("Warden's") }]);
  });

  it("a misspelt setting is caught by Traefik's schema, on its line", () => {
    const r = checkConfig(EMPTY_PROXY_FORM, "http:\n  routers:\n    a:\n      rull: Host(`a.com`)\n      service: noop@internal\n");
    expect(r.ok).toBe(false);
    expect(r.problems.some((p) => /rull/.test(p.message) && p.line != null && p.line >= 3)).toBe(true);
  });

  it("a route to a service or middleware that isn't defined is refused", () => {
    const r = checkConfig(EMPTY_PROXY_FORM, "http:\n  routers:\n    a:\n      rule: Host(`a.com`)\n      service: nope\n      middlewares: [missing]\n");
    expect(r.problems.map((p) => p.message)).toEqual([
      'Router "a" uses the service "nope", which isn\'t defined',
      'Router "a" uses the middleware "missing", which isn\'t defined',
    ]);
    expect(r.problems[0].line).toBe(3);
  });

  it("a list instead of a map is refused; empty is fine", () => {
    expect(checkConfig(EMPTY_PROXY_FORM, "- a\n- b\n").ok).toBe(false);
    const empty = checkConfig(EMPTY_PROXY_FORM, "  \n");
    expect(empty.ok).toBe(true);
    expect(empty.yaml.trim().endsWith("{}")).toBe(true);
  });
});
