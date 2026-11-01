import { describe, expect, it } from "vitest";
import { CreateFromRepoSchema, type DetectedApp } from "shared-types";
import { appToForm, formField, formsToInput, looksLikeDotenv, mergePastedEnv } from "./repoForm";
import { parseRepo } from "./hooks/useRepoServices";

const site: DetectedApp = {
  path: "apps/frontend",
  name: "frontend",
  packageName: "frontend",
  framework: "Vite",
  type: "APPLICATION",
  website: true,
  buildMethod: "RAILPACK",
  rootDirectory: "",
  dockerfilePath: "apps/frontend/Dockerfile",
  buildCommand: "pnpm turbo run build --filter=frontend...",
  startCommand: null,
  staticOutputDir: "apps/frontend/dist",
  port: 3000,
  healthCheckPath: "/health",
  watchPaths: ["apps/frontend/**", "packages/**"],
  buildVars: ["VITE_API_URL", "VITE_GA_ID"],
  notes: [],
};
const SERVER = "11111111-1111-4111-8111-111111111111";
const ENV = "22222222-2222-4222-8222-222222222222";

describe("repo form", () => {
  it("a detected website round-trips into a valid request; blank variables are dropped", () => {
    const form = appToForm(site, SERVER);
    expect(form.vars).toEqual([
      { key: "VITE_API_URL", value: "" },
      { key: "VITE_GA_ID", value: "" },
    ]);
    form.vars[0].value = "https://api.example.com";
    form.startCommand = "should be ignored for a website";
    const input = formsToInput(ENV, { installationId: null, repo: "acme/web", branch: "main" }, [form], true);
    const s = input.services[0];
    expect(s).toMatchObject({ port: 3000, startCommand: null, staticOutputDir: "apps/frontend/dist", watchPaths: ["apps/frontend/**", "packages/**"] });
    expect(s.variables).toEqual([{ key: "VITE_API_URL", value: "https://api.example.com" }]);
    expect(CreateFromRepoSchema.safeParse(input).success).toBe(true);
  });

  it("api errors land on the matching form field", () => {
    expect(formField(["services", 1, "port"])).toBe("apps.1.port");
    expect(formField(["services", 0, "watchPaths", 2])).toBe("apps.0.watchPathsText");
    expect(formField(["services", 0, "variables"])).toBe("apps.0.vars");
    expect(formField(["environmentId"])).toBeNull();
  });

  it("parses the ways people write a repo", () => {
    for (const s of ["acme/api", "https://github.com/acme/api", "github.com/acme/api.git", "https://github.com/acme/api/"]) expect(parseRepo(s)).toBe("acme/api");
    expect(parseRepo("not a repo")).toBeNull();
  });
});

describe("pasting a .env into the variables", () => {
  it("tells a .env from a plain key", () => {
    expect(looksLikeDotenv("VITE_API_URL")).toBe(false);
    expect(looksLikeDotenv("VITE_API_URL=https://api.example.com")).toBe(true);
    expect(looksLikeDotenv("A=1\nB=2")).toBe(true);
    expect(looksLikeDotenv("export TOKEN=x")).toBe(true);
  });

  it("fills keys already there, adds new ones, drops the empty row it went into, reports bad lines", () => {
    const rows = [
      { key: "VITE_API_URL", value: "" },
      { key: "", value: "" },
    ];
    const r = mergePastedEnv(rows, "# comment\nVITE_API_URL=https://api.example.com\nJWT_SECRET='s3cret # kept'\nnot a line\nJWT_SECRET=last-wins", 1);
    expect(r.rows).toEqual([
      { key: "VITE_API_URL", value: "https://api.example.com" },
      { key: "JWT_SECRET", value: "last-wins" },
    ]);
    expect(r).toMatchObject({ added: 1, updated: 1, problems: ["line 4: No = sign: expected KEY=value"] });
  });

  it("the whole request stays under the api's body limit", () => {
    const big = { ...appToForm(site, "6f9619ff-8b86-4d01-b42d-00cf4fc964ff"), vars: Array.from({ length: 5 }, (_, i) => ({ key: `K${i}`, value: "x".repeat(15_000) })) };
    const r = CreateFromRepoSchema.safeParse(formsToInput("6f9619ff-8b86-4d01-b42d-00cf4fc964ff", { installationId: null, repo: "acme/api", branch: "" }, [big], true));
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path.join("."))).toContain("services.0.variables");
  });
});
