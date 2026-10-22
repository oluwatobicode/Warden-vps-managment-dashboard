import type { CreateFromRepoInput, DetectedApp } from "shared-types";

/** One app on the "Check and deploy" step: everything editable, as the inputs hold it (text). */
export interface AppForm {
  /** Which detected app this is (its folder; "." for the repo root). */
  key: string;
  framework: string;
  website: boolean;
  buildMethod: DetectedApp["buildMethod"];
  notes: string[];
  serviceName: string;
  type: "APPLICATION" | "WORKER";
  serverId: string;
  port: string;
  rootDirectory: string;
  dockerfilePath: string;
  buildCommand: string;
  startCommand: string;
  staticOutputDir: string;
  healthCheckPath: string;
  /** One per line. */
  watchPathsText: string;
  vars: Array<{ key: string; value: string }>;
}

export interface RepoSource {
  installationId: string | null;
  repo: string;
  branch: string;
}

export const appKey = (a: Pick<DetectedApp, "path">) => a.path || ".";

/** A detected app → its form, on the given server. Build-time variables start as empty rows to fill. */
export function appToForm(a: DetectedApp, serverId: string): AppForm {
  return {
    key: appKey(a),
    framework: a.framework,
    website: a.website,
    buildMethod: a.buildMethod,
    notes: a.notes,
    serviceName: a.name,
    type: a.type,
    serverId,
    port: a.port == null ? "" : String(a.port),
    rootDirectory: a.rootDirectory,
    dockerfilePath: a.dockerfilePath,
    buildCommand: a.buildCommand ?? "",
    startCommand: a.startCommand ?? "",
    staticOutputDir: a.staticOutputDir ?? "",
    healthCheckPath: a.healthCheckPath,
    watchPathsText: a.watchPaths.join("\n"),
    vars: a.buildVars.map((key) => ({ key, value: "" })),
  };
}

const lines = (text: string) =>
  text
    .split(/[\n,]+/)
    .map((l) => l.trim())
    .filter(Boolean);

/**
 * The forms → the request body, not yet validated (CreateFromRepoSchema does
 * that, the same schema the api uses). Empty variable values are dropped: a
 * row someone left blank shouldn't become an empty secret.
 */
export function formsToInput(environmentId: string, source: RepoSource, apps: AppForm[], deploy: boolean): CreateFromRepoInput {
  return {
    environmentId,
    installationId: source.installationId,
    repo: source.repo,
    branch: source.branch,
    deploy,
    services: apps.map((f) => ({
      serviceName: f.serviceName.trim(),
      type: f.type,
      serverId: f.serverId,
      rootDirectory: f.rootDirectory.trim(),
      dockerfilePath: f.dockerfilePath.trim() || "Dockerfile",
      buildCommand: f.buildCommand.trim() || null,
      startCommand: f.website ? null : f.startCommand.trim() || null,
      staticOutputDir: f.staticOutputDir.trim() || null,
      port: f.type === "WORKER" || f.port.trim() === "" ? null : Number(f.port),
      healthCheckPath: f.healthCheckPath.trim() || "/",
      watchPaths: lines(f.watchPathsText),
      variables: f.vars.filter((v) => v.key.trim() && v.value !== "").map((v) => ({ key: v.key.trim(), value: v.value })),
    })),
  };
}

/** An API field ("services.1.port") → the form field holding it ("apps.1.port"). */
export function formField(path: PropertyKey[]): string | null {
  if (path[0] !== "services" || typeof path[1] !== "number") return null;
  const map: Record<string, string> = { watchPaths: "watchPathsText", variables: "vars" };
  const field = String(path[2] ?? "");
  return field ? `apps.${path[1]}.${map[field] ?? field}` : null;
}
