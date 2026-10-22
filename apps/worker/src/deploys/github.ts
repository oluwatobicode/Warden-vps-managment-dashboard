import { installationToken as mint, type GithubAppConfig } from "github-app";
import { env } from "../env";

/** The App's keys from .env, or null when this Warden has no GitHub App (public repos only). */
export function githubApp(): GithubAppConfig | null {
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) return null;
  return { appId: env.GITHUB_APP_ID, privateKey: env.GITHUB_APP_PRIVATE_KEY, webhookSecret: env.GITHUB_APP_WEBHOOK_SECRET, slug: env.GITHUB_APP_SLUG };
}

/** A 1-hour key to clone one installation's repos. */
export async function installationToken(installationId: number): Promise<string> {
  const cfg = githubApp();
  if (!cfg) throw new Error("This Warden has no GitHub App set up (GITHUB_APP_* in the worker's .env), so private repos can't be cloned");
  return mint(cfg, installationId);
}
