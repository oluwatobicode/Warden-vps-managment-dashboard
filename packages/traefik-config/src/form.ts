import type { ProxyForm } from "shared-types";

/*
 * The form → Traefik's file-provider config. Every name it makes starts with
 * "form-", so it can never clash with Warden's app routes ("svc-…") or with
 * names in the free YAML (which may not start with "form-").
 */

export interface DynamicConfig {
  http?: {
    routers?: Record<string, Record<string, unknown>>;
    middlewares?: Record<string, Record<string, unknown>>;
    services?: Record<string, Record<string, unknown>>;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

/** "old.example.com" → "old-example-com" (Traefik names: letters, digits, dashes). */
export const nameOf = (domain: string) => domain.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Requests from Traefik reach the server itself through Docker's host gateway (the proxy is started with it). */
export const HOST = "host.docker.internal";

export function formToConfig(form: ProxyForm): DynamicConfig {
  const routers: Record<string, Record<string, unknown>> = {};
  const middlewares: Record<string, Record<string, unknown>> = {};
  const services: Record<string, Record<string, unknown>> = {};
  const toHttps = () => (middlewares["form-to-https"] = { redirectScheme: { scheme: "https", permanent: true } });

  for (const r of form.routes) {
    const n = `form-route-${nameOf(r.domain)}`;
    services[n] = { loadBalancer: { servers: [{ url: `http://${HOST}:${r.port}` }] } };
    if (r.https) {
      routers[n] = { rule: `Host(\`${r.domain}\`)`, entryPoints: ["websecure"], service: n, tls: { certResolver: "le" } };
      routers[`${n}-http`] = { rule: `Host(\`${r.domain}\`)`, entryPoints: ["web"], middlewares: ["form-to-https"], service: "noop@internal" };
      toHttps();
    } else {
      routers[n] = { rule: `Host(\`${r.domain}\`)`, entryPoints: ["web"], service: n };
    }
  }

  for (const r of form.redirects) {
    const n = `form-redirect-${nameOf(r.from)}`;
    const target = r.to.replace(/\/+$/, "");
    middlewares[n] = {
      redirectRegex: {
        regex: `^https?://${escapeRegex(r.from)}(/.*)?$`,
        replacement: r.keepPath ? `${target}\${1}` : `${target}/`,
        permanent: r.permanent,
      },
    };
    routers[n] = { rule: `Host(\`${r.from}\`)`, entryPoints: ["web"], middlewares: [n], service: "noop@internal" };
    if (r.https) {
      routers[`${n}-https`] = { rule: `Host(\`${r.from}\`)`, entryPoints: ["websecure"], middlewares: [n], service: "noop@internal", tls: { certResolver: "le" } };
    }
  }

  if (form.forceHttps) {
    // Lowest priority: any route that matches first wins. sslip.io names are
    // left alone, because they have no certificates.
    routers["form-force-https"] = { rule: "!HostRegexp(`.+\\.sslip\\.io`)", entryPoints: ["web"], priority: 1, middlewares: ["form-to-https"], service: "noop@internal" };
    toHttps();
  }

  const http: NonNullable<DynamicConfig["http"]> = {};
  if (Object.keys(routers).length) http.routers = routers;
  if (Object.keys(middlewares).length) http.middlewares = middlewares;
  if (Object.keys(services).length) http.services = services;
  return Object.keys(http).length ? { http } : {};
}
