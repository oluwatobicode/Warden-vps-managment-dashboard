import { createHash } from "node:crypto";
import { q, writePrivateFile, type Run } from "docker-client";
import type { Stream } from "ssh-client";
import type { DeployLog } from "./logger";
import { buildError, streamed } from "./source";

/*
 * Railpack (railpack.com, Railway's successor to Nixpacks): for repos with no
 * Dockerfile, it reads the code and writes the build plan itself. Two steps:
 * `railpack prepare` makes the plan; `docker buildx build` with Railpack's
 * BuildKit frontend builds it. The CLI and the frontend must be the same
 * version, so both are pinned here.
 */

export const RAILPACK_VERSION = "0.43.0";
const FRONTEND = `ghcr.io/railwayapp/railpack-frontend:v${RAILPACK_VERSION}`;
const BUILD_TIMEOUT_S = 20 * 60;

/** Railpack's own settings: these are configuration, never secrets, so their values go on the plan. */
const CONFIG_KEY = /^(RAILPACK_|NIXPACKS_)|_VERSION$/;

/**
 * Download the Railpack binary into ~/.warden/bin the first time, checking it
 * against the release's published SHA-256 before it's ever run.
 */
async function ensureRailpack(run: Run, log: DeployLog, base: string): Promise<string> {
  const bin = `${base}/bin/railpack-${RAILPACK_VERSION}`;
  if ((await run(`test -x ${q(bin)}`)).code === 0) return bin;

  const arch = (await run("uname -m")).stdout.trim();
  const target = arch === "x86_64" || arch === "amd64" ? "x86_64" : arch === "aarch64" || arch === "arm64" ? "arm64" : null;
  if (!target) throw new Error(`Railpack has no build for this server's CPU (${arch}). Add a Dockerfile to the repo instead`);
  log.say(`Installing Railpack ${RAILPACK_VERSION} on the server (once)`);

  const file = `railpack-v${RAILPACK_VERSION}-${target}-unknown-linux-musl.tar.gz`;
  const url = `https://github.com/railwayapp/railpack/releases/download/v${RAILPACK_VERSION}`;
  const tmp = `${base}/bin/.railpack-download`;
  const fetch = (u: string, out: string) => `(curl -fsSL ${q(u)} -o ${q(out)} || wget -q ${q(u)} -O ${q(out)})`;
  const script = [
    `mkdir -p ${q(tmp)}`,
    `cd ${q(tmp)}`,
    fetch(`${url}/${file}`, file),
    fetch(`${url}/checksums.txt`, "checksums.txt"),
    // Refuse a download that doesn't match the published checksum.
    `grep ' ${file}$' checksums.txt | sha256sum -c -`,
    `tar xzf ${q(file)} railpack`,
    `chmod 755 railpack`,
    `mv railpack ${q(bin)}`,
  ].join(" && ");
  const r = await run(`${script}; code=$?; rm -rf ${q(tmp)}; exit $code`);
  if (r.code !== 0) throw new Error(`Couldn't install Railpack on the server: ${(r.stderr || r.stdout).trim().split("\n").pop()}`);
  return bin;
}

export interface RailpackOptions {
  contextDir: string;
  tag: string;
  serviceId: string;
  buildCommand: string | null;
  startCommand: string | null;
  /** A website's built folder: Railpack serves it as static files on $PORT. */
  staticOutputDir: string | null;
  /** The app's variables: offered to the build as secrets (some builds need them, e.g. NEXT_PUBLIC_*). */
  vars: Record<string, string>;
  /** ~/.warden on the server. */
  home: string;
}

export async function buildRailpack(run: Run, stream: Stream, log: DeployLog, o: RailpackOptions): Promise<void> {
  const bin = await ensureRailpack(run, log, o.home);
  const work = `${o.home}/railpack-${o.serviceId}-${Date.now()}`;
  const plan = `${work}/plan.json`;
  const secrets = `${work}/secrets`;
  try {
    const config: Record<string, string> = {};
    if (o.buildCommand) config.RAILPACK_BUILD_CMD = o.buildCommand;
    if (o.startCommand) config.RAILPACK_START_CMD = o.startCommand;
    // Turns on Railpack's static-site mode for that folder (a start command would turn it off).
    if (o.staticOutputDir) config.RAILPACK_SPA_OUTPUT_DIR = o.staticOutputDir;
    const secretKeys: string[] = [];
    for (const [k, v] of Object.entries(o.vars)) {
      if (CONFIG_KEY.test(k)) config[k] = v;
      else if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) secretKeys.push(k);
    }

    // The plan records secret NAMES only; their values never touch a command line.
    await run(`mkdir -p ${q(secrets)} && chmod 700 ${q(work)}`);
    const envFlags = [
      ...Object.entries(config).map(([k, v]) => `--env ${q(`${k}=${v}`)}`),
      ...secretKeys.map((k) => `--env ${q(`${k}=`)}`),
    ].join(" ");
    const prep = await streamed(stream, log, `${q(bin)} prepare ${q(o.contextDir)} --plan-out ${q(plan)} ${envFlags}`);
    if (prep.code !== 0) {
      throw new Error(
        /could not determine|no provider|unable to generate/i.test(prep.tail)
          ? "Railpack couldn't work out how to build this repo. Add a Dockerfile, or set a build and start command in the service's Settings"
          : "Railpack couldn't make a build plan (see the log)",
      );
    }
    // A plan with nothing to start would build fine and then fail the health
    // check 90 s later with no output. Say what's wrong now instead.
    let planned: { deploy?: { startCommand?: string } } = {};
    try {
      planned = JSON.parse((await run(`cat ${q(plan)}`)).stdout) as typeof planned;
    } catch {
      // an unreadable plan fails in the build step with its own error
    }
    if (!planned.deploy?.startCommand?.trim() && !o.startCommand) {
      throw new Error(
        "Railpack found nothing to start in this repo. If it's a website, set \"Built site folder\" in Settings → Build & start (\".\" for files at the repo root, or e.g. \"dist\"). If it's a server, add a \"start\" script to package.json or set a start command",
      );
    }

    // Each secret in its own 0600 file, read by BuildKit as `--secret id=K,src=file`.
    // EVERY key given to `prepare` is one the plan's build steps read as a
    // BuildKit secret: Railpack's own settings (RAILPACK_SPA_OUTPUT_DIR, the
    // build/start commands…) as well as the app's variables. Missing one fails
    // the build with "secret X: not found", so each gets its own 0600 file.
    const buildValues: Record<string, string> = { ...config };
    for (const k of secretKeys) buildValues[k] = o.vars[k];
    const buildKeys = Object.keys(buildValues);
    for (const k of buildKeys) await writePrivateFile(run, `${secrets}/${k}`, buildValues[k]);
    const hash = createHash("sha256")
      .update(buildKeys.map((k) => `${k}=${buildValues[k]}`).join("\n"))
      .digest("hex");

    const r = await streamed(
      stream,
      log,
      [
        `cd ${q(o.contextDir)} &&`,
        `timeout ${BUILD_TIMEOUT_S}`,
        "docker buildx build --progress=plain --load",
        `--build-arg ${q(`BUILDKIT_SYNTAX=${FRONTEND}`)}`,
        `-f ${q(plan)}`,
        // A secret changing must rebuild; each service keeps its own build cache.
        `--build-arg ${q(`secrets-hash=${hash}`)}`,
        `--build-arg ${q(`cache-key=${o.serviceId}`)}`,
        ...buildKeys.map((k) => `--secret ${q(`id=${k},src=${secrets}/${k}`)}`),
        `-t ${q(o.tag)}`,
        "--label warden=1",
        `--label ${q(`warden.service=${o.serviceId}`)}`,
        ".",
      ].join(" "),
    );
    if (r.code !== 0) throw buildError(r.code, r.tail);
  } finally {
    await run(`rm -rf ${q(work)}`);
  }
}
