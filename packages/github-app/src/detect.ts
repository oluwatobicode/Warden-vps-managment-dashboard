/*
 * Reading a repo to prefill "Add service": which apps are in it, how each is
 * built and started, its port, and the build-time variables it needs.
 * Pure: it only sees a file list and a way to read a file, so it's tested
 * with fake repos (detect.test.ts). Railpack still does the real build; this
 * is the well-informed guess the form starts from.
 */

export interface RepoFiles {
  /** Every file path in the repo ("apps/api/package.json"…). */
  files: string[];
  /** A file's text, or null if it isn't there or is too big. */
  read: (path: string) => Promise<string | null>;
  /** Used as the name of a repo-root app. */
  repoName: string;
}

export interface DetectedApp {
  path: string;
  name: string;
  packageName: string | null;
  framework: string;
  type: "APPLICATION" | "WORKER";
  website: boolean;
  buildMethod: "DOCKERFILE" | "RAILPACK";
  rootDirectory: string;
  dockerfilePath: string;
  buildCommand: string | null;
  startCommand: string | null;
  staticOutputDir: string | null;
  port: number | null;
  healthCheckPath: string;
  watchPaths: string[];
  buildVars: string[];
  notes: string[];
}

interface Pkg {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
  main?: string;
}

type PM = "pnpm" | "yarn" | "bun" | "npm";

const join = (...parts: string[]) => parts.filter(Boolean).join("/");
const slug = (s: string) =>
  s
    .replace(/^@[^/]+\//, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "app";

/** "apps/*" → apps/<one folder>; "packages/**" → any depth. Negations ("!x") are ignored by the caller. */
function globToRegExp(glob: string): RegExp {
  const g = glob.replace(/^\.\//, "").replace(/\/+$/, "");
  const re = g
    .split("**")
    .map((part) => part.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]+"))
    .join(".+");
  return new RegExp(`^${re}$`);
}

/** The `packages:` list of a pnpm-workspace.yaml (simple YAML, which is what these files are). */
export function pnpmWorkspaceGlobs(yaml: string): string[] {
  const out: string[] = [];
  let inPackages = false;
  for (const raw of yaml.split("\n")) {
    const line = raw.replace(/#.*$/, "");
    if (/^packages\s*:/.test(line)) {
      inPackages = true;
      continue;
    }
    if (inPackages) {
      const m = line.match(/^\s*-\s*["']?([^"']+?)["']?\s*$/);
      if (m) out.push(m[1]);
      else if (/^\S/.test(line)) inPackages = false;
    }
  }
  return out;
}

const parse = (text: string | null): Pkg | null => {
  if (!text) return null;
  try {
    return JSON.parse(text) as Pkg;
  } catch {
    return null;
  }
};

const BUILD_VAR = /\b((?:VITE|NEXT_PUBLIC|PUBLIC|REACT_APP|NUXT_PUBLIC)_[A-Z0-9_]+)\b/g;
const WORKER_DEPS = ["bullmq", "bull", "agenda", "node-cron", "bee-queue", "@temporalio/worker"];

function framework(pkg: Pkg): { label: string; website: boolean; server: boolean } | null {
  const d = { ...pkg.dependencies, ...pkg.devDependencies };
  const has = (n: string) => n in d;
  const build = pkg.scripts?.build ?? "";
  if (has("next")) return { label: "Next.js", website: false, server: true };
  if (has("nuxt")) return { label: "Nuxt", website: false, server: true };
  if (has("@sveltejs/kit")) return { label: "SvelteKit", website: false, server: true };
  if (has("@remix-run/node") || has("@react-router/dev")) return { label: "React Router", website: false, server: true };
  if (has("astro")) return { label: "Astro", website: true, server: false };
  if (has("@nestjs/core")) return { label: "NestJS", website: false, server: true };
  if (has("express")) return { label: "Express", website: false, server: true };
  if (has("fastify")) return { label: "Fastify", website: false, server: true };
  if (has("hono")) return { label: "Hono", website: false, server: true };
  if (has("koa")) return { label: "Koa", website: false, server: true };
  if (has("react-scripts")) return { label: "Create React App", website: true, server: false };
  if (has("vite") || /\bvite build\b/.test(build)) return { label: "Vite", website: true, server: false };
  return null;
}

interface Ctx {
  repo: RepoFiles;
  has: (p: string) => boolean;
  pm: PM;
  turbo: boolean;
  /** Set when the repo is a monorepo. */
  workspaceGlobs: string[] | null;
}

/** Variables a website bakes in at build time, from the files that usually list them. */
async function buildVarsOf(ctx: Ctx, dir: string): Promise<string[]> {
  const candidates = [".env.example", ".env.sample", ".env.template", ".env.local.example", "src/vite-env.d.ts", "env.d.ts", "src/env.d.ts"].flatMap((f) =>
    dir ? [join(dir, f), f] : [f],
  );
  const found = new Set<string>();
  for (const p of [...new Set(candidates)].filter(ctx.has).slice(0, 6)) {
    for (const m of (await ctx.repo.read(p))?.matchAll(BUILD_VAR) ?? []) found.add(m[1]);
  }
  return [...found].sort();
}

const run = (pm: PM, script: string) => (pm === "npm" ? `npm run ${script}` : `${pm} run ${script}`);

async function nodeApp(ctx: Ctx, dir: string, pkg: Pkg): Promise<DetectedApp | null> {
  const fw = framework(pkg);
  const scripts = pkg.scripts ?? {};
  const startScript = scripts["start:prod"] ? "start:prod" : scripts.start ? "start" : null;
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const looksWorker = !fw?.server && !fw?.website && (WORKER_DEPS.some((d) => d in deps) || /worker/i.test(dir) || /worker/i.test(pkg.name ?? ""));
  // A library (packages/db, shared-types…): nothing to start and nothing to serve.
  if (!fw && !startScript && !looksWorker) return null;

  const mono = ctx.workspaceGlobs !== null;
  const dockerfile = join(dir, "Dockerfile");
  const hasDocker = ctx.has(dockerfile);
  const website = !!fw?.website && !hasDocker;
  const type: DetectedApp["type"] = looksWorker ? "WORKER" : "APPLICATION";
  const name = dir ? slug(dir.split("/").pop()!) : slug(ctx.repo.repoName);
  const notes: string[] = [];

  // In a monorepo, build from the repo ROOT so the app can use the shared packages.
  let buildCommand: string | null = null;
  let startCommand: string | null = null;
  if (mono && dir && pkg.name) {
    if (scripts.build) {
      buildCommand = ctx.turbo
        ? `${ctx.pm === "npm" ? "npx" : ctx.pm} turbo run build --filter=${pkg.name}...`
        : ctx.pm === "pnpm"
          ? `pnpm --filter "${pkg.name}..." run build`
          : ctx.pm === "yarn"
            ? `yarn workspace ${pkg.name} run build`
            : `npm run build --workspace=${dir}`;
    }
    if (startScript && !website) {
      startCommand =
        ctx.pm === "pnpm" ? `pnpm --filter ${pkg.name} run ${startScript}` : ctx.pm === "yarn" ? `yarn workspace ${pkg.name} run ${startScript}` : `npm run ${startScript} --workspace=${dir}`;
    }
    notes.push("Built from the repo root, so it can use the repo's shared packages.");
  } else if (!hasDocker) {
    if (scripts.build) notes.push(`Railpack runs \`${run(ctx.pm, "build")}\`.`);
    if (startScript && !website) notes.push(`It starts with \`${run(ctx.pm, startScript)}\`.`);
  }
  if (startScript === "start:prod") notes.push("Uses the start:prod script.");

  const outDir = fw?.label === "Create React App" ? "build" : "dist";
  const staticOutputDir = website && mono && dir ? join(dir, outDir) : null;
  if (website) notes.push(`A website: it's built to ${join(dir, outDir)} and served as static files.`);
  else if (type === "APPLICATION") notes.push("It must listen on the PORT variable (Warden sets it to the service's port).");
  if (hasDocker) notes.push(`Uses its Dockerfile (${dockerfile}).`);

  const buildVars = website || fw?.label === "Next.js" || fw?.label === "Astro" ? await buildVarsOf(ctx, dir) : [];
  if (buildVars.length) notes.push("Its build-time variables are baked in when it's built: set them before deploying.");

  return {
    path: dir,
    name,
    packageName: pkg.name ?? null,
    framework: hasDocker ? `${fw?.label ?? "Node"} (Dockerfile)` : (fw?.label ?? (looksWorker ? "Node worker" : "Node")),
    type,
    website,
    buildMethod: hasDocker ? "DOCKERFILE" : "RAILPACK",
    rootDirectory: mono ? "" : dir,
    dockerfilePath: mono ? dockerfile : "Dockerfile",
    buildCommand: hasDocker ? null : buildCommand,
    startCommand: hasDocker ? null : startCommand,
    staticOutputDir,
    port: type === "WORKER" ? null : 3000,
    // Railpack's static-site server answers /health; other apps start at /.
    healthCheckPath: website ? "/health" : "/",
    watchPaths: mono && dir ? [`${dir}/**`, ...(ctx.workspaceGlobs ?? []).filter((g) => !globToRegExp(g).test(dir) && !g.startsWith("!")).map((g) => g.replace(/\/\*+$/, "/**")), lockfileOf(ctx.pm)] : [],
    buildVars,
    notes,
  };
}

const lockfileOf = (pm: PM) => ({ pnpm: "pnpm-lock.yaml", yarn: "yarn.lock", bun: "bun.lock", npm: "package-lock.json" })[pm];

/** A non-Node app at the repo root (Railpack knows these languages). */
function otherApp(ctx: Ctx): DetectedApp | null {
  const has = ctx.has;
  const lang = has("Dockerfile")
    ? { label: "Dockerfile", port: 3000 }
    : has("requirements.txt") || has("pyproject.toml") || has("Pipfile")
      ? { label: "Python", port: 8000 }
      : has("go.mod")
        ? { label: "Go", port: 8080 }
        : has("Cargo.toml")
          ? { label: "Rust", port: 8080 }
          : has("Gemfile")
            ? { label: "Ruby", port: 3000 }
            : has("composer.json")
              ? { label: "PHP", port: 8080 }
              : has("index.html")
                ? { label: "Static site", port: 3000 }
                : null;
  if (!lang) return null;
  const docker = lang.label === "Dockerfile";
  const site = lang.label === "Static site";
  // Plain HTML with a stray package.json (nothing to build or start): Railpack
  // would treat it as a Node app with nothing to run, so point it at the folder
  // to serve. Without a package.json, Railpack serves the HTML by itself.
  const siteFolder = site && has("package.json") ? "." : null;
  return {
    path: "",
    name: slug(ctx.repo.repoName),
    packageName: null,
    framework: lang.label,
    type: "APPLICATION",
    website: site,
    buildMethod: docker ? "DOCKERFILE" : "RAILPACK",
    rootDirectory: "",
    dockerfilePath: "Dockerfile",
    buildCommand: null,
    startCommand: null,
    staticOutputDir: siteFolder,
    port: lang.port,
    healthCheckPath: "/",
    watchPaths: [],
    buildVars: [],
    notes: site
      ? ["A website of plain files: they're served as they are, with nothing to build or start."]
      : [docker ? "Uses the repo's Dockerfile." : `Railpack builds it as a ${lang.label} app.`, "It must listen on the PORT variable (Warden sets it to the service's port)."],
  };
}

export async function detectApps(repo: RepoFiles): Promise<{ monorepo: boolean; apps: DetectedApp[] }> {
  const set = new Set(repo.files);
  const has = (p: string) => set.has(p);
  const rootPkg = parse(has("package.json") ? await repo.read("package.json") : null);
  const pm: PM = has("pnpm-lock.yaml") || has("pnpm-workspace.yaml") ? "pnpm" : has("yarn.lock") ? "yarn" : has("bun.lock") || has("bun.lockb") ? "bun" : "npm";

  let globs: string[] = [];
  if (has("pnpm-workspace.yaml")) globs = pnpmWorkspaceGlobs((await repo.read("pnpm-workspace.yaml")) ?? "");
  else if (Array.isArray(rootPkg?.workspaces)) globs = rootPkg.workspaces;
  else if (rootPkg?.workspaces && Array.isArray(rootPkg.workspaces.packages)) globs = rootPkg.workspaces.packages;
  globs = globs.filter((g) => !g.startsWith("!"));

  const ctx: Ctx = { repo, has, pm, turbo: has("turbo.json"), workspaceGlobs: globs.length ? globs : null };

  if (globs.length) {
    const patterns = globs.map(globToRegExp);
    const dirs = repo.files
      .filter((f) => f.endsWith("/package.json"))
      .map((f) => f.slice(0, -"/package.json".length))
      .filter((d) => !d.includes("node_modules") && patterns.some((p) => p.test(d)))
      .sort((a, b) => Number(!a.startsWith("apps/")) - Number(!b.startsWith("apps/")) || a.localeCompare(b))
      .slice(0, 30);
    const apps: DetectedApp[] = [];
    for (const dir of dirs) {
      const pkg = parse(await repo.read(`${dir}/package.json`));
      const app = pkg && (await nodeApp(ctx, dir, pkg));
      if (app) apps.push(app);
    }
    // Same folder names in two places ("apps/web", "examples/web"): keep names unique.
    const seen = new Map<string, number>();
    for (const a of apps) {
      const n = (seen.get(a.name) ?? 0) + 1;
      seen.set(a.name, n);
      if (n > 1) a.name = `${a.name}-${n}`;
    }
    return { monorepo: true, apps };
  }

  const ctxSingle: Ctx = { ...ctx, workspaceGlobs: null };
  if (rootPkg) {
    const app = await nodeApp(ctxSingle, "", rootPkg);
    if (app) return { monorepo: false, apps: [app] };
  }
  const other = otherApp(ctxSingle);
  return { monorepo: false, apps: other ? [other] : [] };
}
