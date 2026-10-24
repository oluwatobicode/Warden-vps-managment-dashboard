import { z } from "zod";

/*
 * The Traefik config editor (server page → Proxy). Warden's own routes come
 * from container labels and are rebuilt on every deploy, so they're shown,
 * never edited. What people edit is one file Traefik watches, warden.yml:
 * the form's settings plus free YAML, combined by packages/traefik-config.
 */

const domain = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(/^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/, "Enter a domain like old.example.com");

/** A domain → an app running directly on the server (not deployed by Warden). */
export const ProxyRouteSchema = z.object({
  domain,
  port: z.number({ error: "Enter a port" }).int("A whole number").min(1, "Ports run from 1 to 65535").max(65535, "Ports run from 1 to 65535"),
  /** HTTPS with a Let's Encrypt certificate (the domain's DNS must point at this server). */
  https: z.boolean(),
});
export type ProxyRoute = z.infer<typeof ProxyRouteSchema>;

/** A domain → another address (www → bare domain, an old name → a new one). */
export const ProxyRedirectSchema = z.object({
  from: domain,
  to: z
    .string()
    .trim()
    .url("Enter a full address, like https://example.com")
    .refine((u) => /^https?:\/\//.test(u), "Start with https:// or http://"),
  /** /blog/post on the old domain goes to /blog/post on the new one. */
  keepPath: z.boolean(),
  /** 301 (browsers and search engines remember it) or 302 (temporary). */
  permanent: z.boolean(),
  https: z.boolean(),
});
export type ProxyRedirect = z.infer<typeof ProxyRedirectSchema>;

export const ProxyFormSchema = z
  .object({
    /** Every http:// request for a real domain → https:// (sslip.io addresses are left alone: they have no certificates). */
    forceHttps: z.boolean(),
    routes: z.array(ProxyRouteSchema).max(50),
    redirects: z.array(ProxyRedirectSchema).max(50),
  })
  .superRefine((f, ctx) => {
    const seen = new Set<string>();
    for (const [i, d] of [...f.routes.map((r) => r.domain), ...f.redirects.map((r) => r.from)].entries()) {
      if (seen.has(d)) ctx.addIssue({ code: "custom", path: [i < f.routes.length ? "routes" : "redirects"], message: `${d} is used twice` });
      seen.add(d);
    }
  });
export type ProxyForm = z.infer<typeof ProxyFormSchema>;

export const EMPTY_PROXY_FORM: ProxyForm = { forceHttps: false, routes: [], redirects: [] };

/** PUT /servers/:id/proxy-config, and POST …/check (the same body, nothing applied). */
export const SaveProxyConfigSchema = z.object({
  form: ProxyFormSchema,
  /** Free YAML (Traefik's file-provider format), merged with what the form makes. May be empty. */
  raw: z.string().max(200_000, "The config can be up to 200,000 characters"),
  /** The version this edit started from: someone else saving in between is refused, not overwritten. */
  baseVersionId: z.uuid().nullable(),
  note: z.string().trim().max(200).optional(),
});
export type SaveProxyConfigInput = z.infer<typeof SaveProxyConfigSchema>;

export const ProxyProblemSchema = z.object({
  /** "raw" = in the free YAML (with a line), "form", or "traefik" (reported after applying). */
  where: z.enum(["raw", "form", "traefik"]),
  line: z.number().int().nullable(),
  message: z.string(),
});
export type ProxyProblem = z.infer<typeof ProxyProblemSchema>;

export const ProxyCheckResultSchema = z.object({
  ok: z.boolean(),
  problems: z.array(ProxyProblemSchema),
  /** The warden.yml that would be written. */
  yaml: z.string(),
});
export type ProxyCheckResult = z.infer<typeof ProxyCheckResultSchema>;

export const ProxyVersionSchema = z.object({
  id: z.string(),
  status: z.enum(["APPLIED", "ROLLED_BACK"]),
  source: z.enum(["FORM", "RAW", "REVERT"]),
  createdByName: z.string().nullable(),
  note: z.string().nullable(),
  /** Why Traefik refused it (ROLLED_BACK). */
  problems: z.array(ProxyProblemSchema),
  createdAt: z.iso.datetime(),
});
export type ProxyVersion = z.infer<typeof ProxyVersionSchema>;

/** One route Traefik is serving right now. */
export const ProxyLiveRouteSchema = z.object({
  name: z.string(),
  /** docker = an app Warden deployed, file = warden.yml, internal = Traefik's own. */
  provider: z.string(),
  /** For a Warden app: its service name. */
  serviceName: z.string().nullable(),
  rule: z.string(),
  entryPoints: z.array(z.string()),
  tls: z.boolean(),
  status: z.string(),
  error: z.string().nullable(),
});
export type ProxyLiveRoute = z.infer<typeof ProxyLiveRouteSchema>;

/** GET /servers/:id/proxy-config */
export const ProxyConfigViewSchema = z.object({
  /** The server's Traefik can take warden.yml (set up or updated since the editor existed). */
  editable: z.boolean(),
  current: z
    .object({ versionId: z.string(), form: ProxyFormSchema, raw: z.string(), yaml: z.string(), createdAt: z.iso.datetime(), createdByName: z.string().nullable() })
    .nullable(),
  versions: z.array(ProxyVersionSchema),
  /** Null when the server couldn't be reached. */
  routes: z.array(ProxyLiveRouteSchema).nullable(),
});
export type ProxyConfigView = z.infer<typeof ProxyConfigViewSchema>;

/** The result of applying or reverting. */
export const ProxyApplyResultSchema = z.object({
  applied: z.boolean(),
  /** Set when Traefik refused the change and the previous version was put back. */
  problems: z.array(ProxyProblemSchema),
  versionId: z.string(),
});
export type ProxyApplyResult = z.infer<typeof ProxyApplyResultSchema>;
