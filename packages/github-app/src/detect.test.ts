import { describe, expect, it } from "vitest";
import { detectApps, pnpmWorkspaceGlobs } from "./detect";

/** A fake repo: path → content (content "" = the file exists but we never read it). */
const repo = (repoName: string, tree: Record<string, string | object>) => ({
  repoName,
  files: Object.keys(tree),
  read: async (p: string) => {
    const v = tree[p];
    return v === undefined ? null : typeof v === "string" ? v : JSON.stringify(v);
  },
});

describe("pnpmWorkspaceGlobs", () => {
  it("reads the packages list, with quotes and comments", () => {
    expect(pnpmWorkspaceGlobs(`packages:\n  - 'apps/*'\n  - "packages/*" # shared\n  - tools/**\nonlyBuiltDependencies:\n  - esbuild\n`)).toEqual(["apps/*", "packages/*", "tools/**"]);
  });
});

describe("detectApps", () => {
  it("finds the apps of a pnpm + turbo monorepo like Warden's, and skips libraries", async () => {
    const r = await detectApps(
      repo("warden", {
        "package.json": { name: "warden", private: true },
        "pnpm-workspace.yaml": "packages:\n  - 'apps/*'\n  - 'packages/*'\n",
        "pnpm-lock.yaml": "",
        "turbo.json": "",
        "apps/api/package.json": { name: "api", scripts: { build: "nest build", start: "nest start", "start:prod": "node dist/main" }, dependencies: { "@nestjs/core": "^12" } },
        "apps/frontend/package.json": { name: "frontend", scripts: { build: "tsc -b && vite build", dev: "vite" }, dependencies: { react: "^19" }, devDependencies: { vite: "^8" } },
        "apps/frontend/src/vite-env.d.ts": "interface ImportMetaEnv { readonly VITE_API_URL: string }",
        "apps/worker/package.json": { name: "worker", scripts: { build: "tsc", start: "node dist/index.js" }, dependencies: { bullmq: "^6" } },
        "packages/db/package.json": { name: "db", main: "dist/index.js", scripts: { build: "tsc" } },
        "packages/shared-types/package.json": { name: "shared-types", scripts: { build: "tsc" } },
      }),
    );
    expect(r.monorepo).toBe(true);
    expect(r.apps.map((a) => `${a.name}:${a.type}:${a.framework}`)).toEqual(["api:APPLICATION:NestJS", "frontend:APPLICATION:Vite", "worker:WORKER:Node worker"]);

    const [api, web, worker] = r.apps;
    expect(api).toMatchObject({
      rootDirectory: "",
      buildMethod: "RAILPACK",
      buildCommand: "pnpm turbo run build --filter=api...",
      startCommand: "pnpm --filter api run start:prod",
      port: 3000,
      healthCheckPath: "/",
      watchPaths: ["apps/api/**", "packages/**", "pnpm-lock.yaml"],
      website: false,
    });
    // A website: Railpack serves the built folder, so no start command (one would switch that off).
    expect(web).toMatchObject({ website: true, startCommand: null, staticOutputDir: "apps/frontend/dist", healthCheckPath: "/health", buildVars: ["VITE_API_URL"] });
    expect(worker).toMatchObject({ port: null, startCommand: "pnpm --filter worker run start" });
  });

  it("a single Express app: Railpack's own build/start, port 3000", async () => {
    const r = await detectApps(repo("shop-api", { "package.json": { name: "shop-api", scripts: { start: "node index.js" }, dependencies: { express: "^5" } }, "package-lock.json": "" }));
    expect(r.monorepo).toBe(false);
    expect(r.apps).toHaveLength(1);
    expect(r.apps[0]).toMatchObject({ name: "shop-api", framework: "Express", rootDirectory: "", buildCommand: null, startCommand: null, port: 3000, type: "APPLICATION" });
    expect(r.apps[0].notes.join(" ")).toContain("npm run start");
  });

  it("a Vite site at the root is a website served on $PORT, its build vars from .env.example", async () => {
    const r = await detectApps(
      repo("portfolio", {
        "package.json": { name: "portfolio", scripts: { build: "vite build" }, devDependencies: { vite: "^8" } },
        ".env.example": "VITE_GA_ID=\nVITE_API_URL=http://localhost\nSECRET=x\n",
      }),
    );
    expect(r.apps[0]).toMatchObject({ website: true, staticOutputDir: null, healthCheckPath: "/health", buildVars: ["VITE_API_URL", "VITE_GA_ID"], port: 3000 });
  });

  it("a Dockerfile wins over Railpack", async () => {
    const r = await detectApps(repo("go-svc", { Dockerfile: "", "go.mod": "" }));
    expect(r.apps[0]).toMatchObject({ framework: "Dockerfile", buildMethod: "DOCKERFILE", dockerfilePath: "Dockerfile" });
    const n = await detectApps(repo("node-docker", { Dockerfile: "", "package.json": { scripts: { start: "node ." }, dependencies: { fastify: "^5" } } }));
    expect(n.apps[0]).toMatchObject({ buildMethod: "DOCKERFILE", framework: "Fastify (Dockerfile)", buildCommand: null, startCommand: null });
  });

  it("other languages get Railpack and the usual port", async () => {
    expect((await detectApps(repo("py", { "requirements.txt": "" }))).apps[0]).toMatchObject({ framework: "Python", port: 8000 });
    expect((await detectApps(repo("go", { "go.mod": "" }))).apps[0]).toMatchObject({ framework: "Go", port: 8080 });
  });

  it("plain HTML with a stray package.json (like blogr) is a website served from the repo root", async () => {
    const r = await detectApps(repo("blogr", { "index.html": "", "style.css": "", "app.js": "", "package.json": { dependencies: { "framer-motion": "^10" } } }));
    expect(r.apps).toHaveLength(1);
    expect(r.apps[0]).toMatchObject({ framework: "Static site", website: true, staticOutputDir: ".", startCommand: null, port: 3000 });
    // Without a package.json, Railpack recognises the HTML itself.
    expect((await detectApps(repo("site", { "index.html": "" }))).apps[0]).toMatchObject({ website: true, staticOutputDir: null });
  });

  it("a repo with nothing to run (a profile README) finds no apps", async () => {
    const r = await detectApps(repo("oluwatobicode", { "README.md": "" }));
    expect(r).toEqual({ monorepo: false, apps: [] });
  });

  it("npm workspaces in package.json, and names stay unique", async () => {
    const r = await detectApps(
      repo("mono", {
        "package.json": { name: "mono", workspaces: ["apps/*", "examples/*"] },
        "apps/web/package.json": { name: "@acme/web", scripts: { build: "next build", start: "next start" }, dependencies: { next: "^16" } },
        "examples/web/package.json": { name: "@acme/example-web", scripts: { start: "node server.js" }, dependencies: { express: "^5" } },
      }),
    );
    expect(r.apps.map((a) => a.name)).toEqual(["web", "web-2"]);
    expect(r.apps[0]).toMatchObject({ framework: "Next.js", buildCommand: "npm run build --workspace=apps/web", startCommand: "npm run start --workspace=apps/web" });
  });
});
