import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import { isMap, LineCounter, parseDocument, stringify, type Document } from "yaml";
import type { ProxyForm, ProxyProblem } from "shared-types";
import schema from "./schema/traefik-v3-file-provider.json";
import { formToConfig, type DynamicConfig } from "./form";

/*
 * Everything that's checked before warden.yml is written. Traefik itself
 * ignores a file it can't parse (it keeps the old config and only logs it),
 * and a route pointing at a missing service just never works, so these must
 * be caught here, with a line number where possible.
 */

const HEADER = "# Written by Warden (server page → Proxy). Edit it there: changes made on the server are overwritten.\n";
/** Warden's app routes are "svc-…" (container labels); the form's are "form-…". */
const RESERVED = /^(svc-|form-)/;
const SECTIONS = ["routers", "middlewares", "services", "serversTransports"] as const;

let validator: ValidateFunction | null = null;
function validate(): ValidateFunction {
  // Compiled once: the schema is ~80 kB. Not strict: SchemaStore schemas use a few extra keywords.
  validator ??= new Ajv({ allErrors: true, strict: false }).compile(schema as object);
  return validator;
}

export interface CheckResult {
  ok: boolean;
  problems: ProxyProblem[];
  /** The warden.yml that would be written (also when there are problems, for the preview). */
  yaml: string;
  config: DynamicConfig;
}

export function checkConfig(form: ProxyForm, raw: string): CheckResult {
  const problems: ProxyProblem[] = [];
  const lines = new LineCounter();
  const doc = parseDocument(raw, { lineCounter: lines, prettyErrors: false, uniqueKeys: true });
  const lineAt = (offset: number | undefined) => (offset == null ? null : lines.linePos(offset).line);

  for (const e of doc.errors) problems.push({ where: "raw", line: lineAt(e.pos[0]), message: `YAML: ${e.message.split("\n")[0]}` });
  let rawConfig: DynamicConfig = {};
  if (!doc.errors.length && raw.trim()) {
    const js = doc.toJS() as unknown;
    if (js && typeof js === "object" && !Array.isArray(js)) rawConfig = js as DynamicConfig;
    else if (js != null) problems.push({ where: "raw", line: 1, message: "The file must be a map (http:, tcp:, …), not a list or a single value" });
  }

  // Names: the free YAML can't use Warden's or the form's names.
  for (const proto of ["http", "tcp", "udp"] as const) {
    for (const section of SECTIONS) {
      for (const name of Object.keys(sectionOf(rawConfig, proto, section))) {
        if (RESERVED.test(name)) {
          problems.push({ where: "raw", line: lineOfKey(doc, lines, [proto, section, name]), message: `"${name}": names starting with svc- or form- are Warden's; pick another` });
        }
      }
    }
  }

  const formConfig = formToConfig(form);
  const config = merge(formConfig, rawConfig);
  const yaml = Object.keys(config).length ? HEADER + stringify(config, { lineWidth: 0 }) : `${HEADER}{}\n`;

  // Traefik's own schema (from SchemaStore).
  if (!problems.length) {
    const v = validate();
    if (!v(config)) {
      for (const e of (v.errors ?? []).slice(0, 10)) problems.push(schemaProblem(e, doc, lines));
    }
  }

  // Every router must point at a service and middlewares that exist. "x@docker"
  // (a Warden app), "x@internal" (Traefik's own) and other providers are allowed.
  if (!problems.length) {
    for (const proto of ["http", "tcp"] as const) {
      const services = sectionOf(config, proto, "services");
      const mws = sectionOf(config, proto, "middlewares");
      for (const [name, r] of Object.entries(sectionOf(config, proto, "routers"))) {
        const svc = (r as { service?: string }).service;
        const at = lineOfKey(doc, lines, [proto, "routers", name]);
        const where = at == null && name.startsWith("form-") ? "form" : "raw";
        if (!svc) problems.push({ where, line: at, message: `Router "${name}" has no service` });
        else if (!svc.includes("@") && !(svc in services)) problems.push({ where, line: at, message: `Router "${name}" uses the service "${svc}", which isn't defined` });
        for (const m of (r as { middlewares?: string[] }).middlewares ?? []) {
          if (!m.includes("@") && !(m in mws)) problems.push({ where, line: at, message: `Router "${name}" uses the middleware "${m}", which isn't defined` });
        }
      }
    }
  }

  return { ok: !problems.length, problems, yaml, config };
}

function sectionOf(c: DynamicConfig, proto: "http" | "tcp" | "udp", section: string): Record<string, unknown> {
  const p = c[proto];
  if (!p || typeof p !== "object") return {};
  const s = (p as Record<string, unknown>)[section];
  return s && typeof s === "object" && !Array.isArray(s) ? (s as Record<string, unknown>) : {};
}

/** The form's part and the free YAML, section by section. A name in both is already refused above (reserved prefix). */
function merge(a: DynamicConfig, b: DynamicConfig): DynamicConfig {
  const out: DynamicConfig = { ...b };
  for (const proto of Object.keys(a)) {
    const fromForm = (a[proto] ?? {}) as Record<string, Record<string, unknown>>;
    const fromRaw = (b[proto] ?? {}) as Record<string, Record<string, unknown>>;
    const merged: Record<string, unknown> = { ...fromRaw };
    for (const section of Object.keys(fromForm)) merged[section] = { ...(fromRaw[section] ?? {}), ...fromForm[section] };
    out[proto] = merged;
  }
  return out;
}

function lineOfKey(doc: Document, lines: LineCounter, path: string[]): number | null {
  let node: unknown = doc.contents;
  for (const key of path) {
    if (!isMap(node)) return null;
    const pair = node.items.find((p) => (p.key as { value?: unknown } | null)?.value === key);
    if (!pair) return null;
    if (key === path[path.length - 1]) {
      const range = (pair.key as { range?: [number, number, number] } | null)?.range;
      return range ? lines.linePos(range[0]).line : null;
    }
    node = pair.value;
  }
  return null;
}

/** An ajv error → a sentence, on the line of the deepest key that exists in the free YAML. */
function schemaProblem(e: ErrorObject, doc: Document, lines: LineCounter): ProxyProblem {
  const path = e.instancePath.split("/").filter(Boolean);
  let line: number | null = null;
  for (let n = path.length; n > 0 && line == null; n--) line = lineOfKey(doc, lines, path.slice(0, n));
  const at = path.length ? path.join(" → ") : "the file";
  const what =
    e.keyword === "additionalProperties"
      ? `"${(e.params as { additionalProperty: string }).additionalProperty}" isn't a Traefik setting here`
      : e.keyword === "type"
        ? `should be ${(e.params as { type: string }).type}`
        : e.keyword === "required"
          ? `needs "${(e.params as { missingProperty: string }).missingProperty}"`
          : e.keyword === "enum"
            ? `must be one of: ${((e.params as { allowedValues: unknown[] }).allowedValues ?? []).join(", ")}`
            : (e.message ?? "isn't valid");
  return { where: line == null && path.some((p) => p.startsWith("form-")) ? "form" : "raw", line, message: `${at}: ${what}` };
}
