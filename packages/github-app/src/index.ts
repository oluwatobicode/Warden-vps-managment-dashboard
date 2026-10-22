import { createHmac, createSign, timingSafeEqual } from "node:crypto";

/*
 * The Warden GitHub App (one App for the whole Warden install, created by the
 * operator; its keys live in the api and worker .env). How it works:
 *
 * 1. Warden proves it IS the App with a JWT signed by the App's private key
 *    (valid 10 minutes).
 * 2. It trades that JWT for an "installation token": a key for ONE account's
 *    installed repos, valid 1 hour. That's what clones private repos.
 * 3. GitHub signs every webhook with the App's webhook secret; Warden checks
 *    the signature before believing a "push happened".
 */

export interface GithubAppConfig {
  appId: string;
  /** The App's private key (PEM). In .env, newlines may be written as \n. */
  privateKey: string;
  webhookSecret: string;
  /** The App's URL name: github.com/apps/<slug> */
  slug: string;
}

const API = "https://api.github.com";

/** .env files can't hold line breaks easily, so "\n" written literally is accepted. */
export const normalizePem = (pem: string) => pem.replace(/\\n/g, "\n").trim() + "\n";

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

/** Step 1: a 10-minute JWT that says "I am the App". */
export function appJwt(cfg: Pick<GithubAppConfig, "appId" | "privateKey">, now = Math.floor(Date.now() / 1000)): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  // iat 60s in the past: GitHub's clock and ours never agree exactly.
  const payload = b64url(JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: cfg.appId }));
  const signature = createSign("RSA-SHA256").update(`${header}.${payload}`).sign(normalizePem(cfg.privateKey));
  return `${header}.${payload}.${b64url(signature)}`;
}

export class GithubError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** `auth` null = GitHub's public API (public repos only, 60 calls an hour per IP). */
async function gh<T>(path: string, auth: string | null, init: { method?: string; body?: unknown; raw?: boolean } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Accept: init.raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      "User-Agent": "warden",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = text.slice(0, 200);
    try {
      message = (JSON.parse(text) as { message?: string }).message ?? message;
    } catch {
      // not JSON
    }
    throw new GithubError(res.status, `GitHub answered ${res.status}: ${message}`);
  }
  return (init.raw ? await res.text() : await res.json()) as T;
}

// Step 2, cached: a token is reused until 5 minutes before it expires.
const tokens = new Map<number, { token: string; expiresAt: number }>();

export async function installationToken(cfg: GithubAppConfig, installationId: number): Promise<string> {
  const cached = tokens.get(installationId);
  if (cached && cached.expiresAt - Date.now() > 5 * 60 * 1000) return cached.token;
  const r = await gh<{ token: string; expires_at: string }>(`/app/installations/${installationId}/access_tokens`, appJwt(cfg), { method: "POST" });
  tokens.set(installationId, { token: r.token, expiresAt: Date.parse(r.expires_at) });
  return r.token;
}

export interface Installation {
  id: number;
  accountLogin: string;
  accountType: string;
}

/** Who installed it. Used to check an install callback is real before saving it. */
export async function getInstallation(cfg: GithubAppConfig, installationId: number): Promise<Installation> {
  const r = await gh<{ id: number; account: { login: string; type: string } | null }>(`/app/installations/${installationId}`, appJwt(cfg));
  return { id: r.id, accountLogin: r.account?.login ?? "unknown", accountType: r.account?.type ?? "User" };
}

export interface Repo {
  id: number;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
}

/** The repos the installation may read (the ones the user ticked on GitHub). */
export async function listRepos(cfg: GithubAppConfig, installationId: number): Promise<Repo[]> {
  const token = await installationToken(cfg, installationId);
  const out: Repo[] = [];
  for (let page = 1; page <= 10; page++) {
    const r = await gh<{ repositories: Array<{ id: number; full_name: string; private: boolean; default_branch: string; html_url: string }> }>(
      `/installation/repositories?per_page=100&page=${page}`,
      token,
    );
    out.push(...r.repositories.map((x) => ({ id: x.id, fullName: x.full_name, private: x.private, defaultBranch: x.default_branch, htmlUrl: x.html_url })));
    if (r.repositories.length < 100) break;
  }
  return out;
}

export async function listBranches(cfg: GithubAppConfig, installationId: number, fullName: string): Promise<string[]> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(fullName)) throw new GithubError(400, "Not a repo name");
  const token = await installationToken(cfg, installationId);
  const out: string[] = [];
  for (let page = 1; page <= 5; page++) {
    const r = await gh<Array<{ name: string }>>(`/repos/${fullName}/branches?per_page=100&page=${page}`, token);
    out.push(...r.map((b) => b.name));
    if (r.length < 100) break;
  }
  return out;
}

/**
 * Step 3: is this webhook really from GitHub? It signs the exact bytes of the
 * body with the App's webhook secret (HMAC-SHA256). Compare in constant time.
 */
export function verifyWebhook(secret: string, rawBody: Buffer | string, signatureHeader: string | undefined): boolean {
  if (!secret || !signatureHeader?.startsWith("sha256=")) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`);
  const given = Buffer.from(signatureHeader);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Does a changed file match a watch path? Supports ** (any depth) and * (within one folder). */
export function matchesWatchPath(file: string, pattern: string): boolean {
  const p = pattern.replace(/\/+$/, "");
  // A bare folder ("apps/api") means everything inside it.
  const glob = /[*]/.test(p) ? p : `${p}/**`;
  const re = glob
    .split("**")
    .map((part) => part.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*"))
    .join(".*");
  return new RegExp(`^${re}$`).test(file);
}

// ── reading a repo for "Add service" ─────────────────────────────────────

export { detectApps, type DetectedApp, type RepoFiles } from "./detect";
import { detectApps, type DetectedApp } from "./detect";

const MAX_FILE_BYTES = 512 * 1024;
const MAX_READS = 40;

/**
 * Read a repo through the API (no clone) and work out its apps. `auth` is an
 * installation token (private repos, 5,000 calls an hour) or null for a
 * public repo. One call for the repo, one for its whole file list, then a
 * few small file reads.
 */
export async function inspectRepo(
  auth: string | null,
  fullName: string,
  branch?: string,
): Promise<{ fullName: string; htmlUrl: string; private: boolean; defaultBranch: string; branch: string; truncated: boolean; monorepo: boolean; apps: DetectedApp[] }> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(fullName)) throw new GithubError(400, "Not a repo name");
  const info = await gh<{ full_name: string; html_url: string; private: boolean; default_branch: string }>(`/repos/${fullName}`, auth);
  const ref = branch || info.default_branch;
  const tree = await gh<{ truncated: boolean; tree: Array<{ path: string; type: string; size?: number }> }>(
    `/repos/${fullName}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    auth,
  );
  const sizes = new Map(tree.tree.filter((t) => t.type === "blob").map((t) => [t.path, t.size ?? 0]));
  let reads = 0;
  const read = async (path: string): Promise<string | null> => {
    const size = sizes.get(path);
    if (size === undefined || size > MAX_FILE_BYTES || reads >= MAX_READS) return null;
    reads++;
    try {
      return await gh<string>(`/repos/${fullName}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`, auth, { raw: true });
    } catch {
      return null;
    }
  };
  const found = await detectApps({ files: [...sizes.keys()], read, repoName: info.full_name.split("/")[1] });
  return { fullName: info.full_name, htmlUrl: info.html_url, private: info.private, defaultBranch: info.default_branch, branch: ref, truncated: tree.truncated, ...found };
}

