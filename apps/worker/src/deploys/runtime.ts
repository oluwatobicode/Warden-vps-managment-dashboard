import { prisma } from "db";
import { containerLogTail, q, removeContainer, removeFile, writePrivateFile, type Run } from "docker-client";
import type { Stream } from "ssh-client";
import { unseal } from "../keys";
import { PROXY_CONTAINER, PROXY_NETWORK } from "./traefik";
import type { DeployLog } from "./logger";
import { streamed } from "./source";

/*
 * Steps 4–8 of a deploy: the release command, starting the new version next
 * to the old one, the health check, the swap, and keeping the last 3 images.
 */

export const PROBE_IMAGE = "busybox:1.38";
/** Images kept per service, for instant rollbacks (the live one is always kept). */
export const KEEP_IMAGES = 3;

/**
 * The app's variables: the environment's, with the service's own on top (same
 * key = the service wins), plus PORT unless set. Values are decrypted here and
 * only ever written to a 0600 file on the server.
 */
export async function appVariables(o: { organizationId: string; environmentId: string; serviceId: string; port: number | null }, log: DeployLog): Promise<Record<string, string>> {
  const [envVars, svcVars] = await Promise.all([
    prisma.environmentVariable.findMany({ where: { environmentId: o.environmentId, organizationId: o.organizationId } }),
    prisma.serviceVariable.findMany({ where: { serviceId: o.serviceId, organizationId: o.organizationId } }),
  ]);
  const out: Record<string, string> = {};
  for (const v of [...envVars, ...svcVars]) {
    const value = await unseal(o.organizationId, v.valueEncrypted);
    // Docker env files are one line per variable: a value with line breaks can't be passed this way.
    if (/[\r\n]/.test(value)) {
      log.say(`Variable ${v.key} has several lines; env files can't hold that, so it was left out`);
      continue;
    }
    out[v.key] = value;
  }
  if (o.port != null && out.PORT === undefined) out.PORT = String(o.port);
  return out;
}

const envFileText = (vars: Record<string, string>) =>
  Object.entries(vars)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n";

/**
 * Write the variables to a private file, run `fn` (which passes it to
 * Docker), and always delete the file: Docker copies the values in at start.
 */
export async function withEnvFile<T>(run: Run, path: string, vars: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  await writePrivateFile(run, path, envFileText(vars));
  try {
    return await fn();
  } finally {
    await removeFile(run, path);
  }
}

/** Step 4: run the release command once in the new image (e.g. a migration). */
export async function releaseCommand(stream: Stream, log: DeployLog, o: { image: string; envFile: string; network: string; command: string; name: string }): Promise<void> {
  const r = await streamed(
    stream,
    log,
    [
      "timeout 600 docker run --rm",
      `--name ${q(o.name)}`,
      `--env-file ${q(o.envFile)}`,
      `--network ${q(o.network)}`,
      "--label warden=1",
      "--entrypoint sh",
      q(o.image),
      `-c ${q(o.command)}`,
    ].join(" "),
  );
  if (r.code === 124) throw new Error("The release command ran longer than 10 minutes and was stopped. The old version is still running");
  if (r.code === 127 || /exec: "sh": executable file not found/i.test(r.tail)) {
    throw new Error("The release command couldn't run: the image has no shell (sh), or the command doesn't exist. The old version is still running");
  }
  if (r.code !== 0) throw new Error(`The release command failed (exit code ${r.code}). The old version is still running`);
}

export interface StartSpec {
  name: string;
  image: string;
  envFile: string;
  /** The environment's private network (its databases live there). */
  network: string;
  serviceId: string;
  deploymentId: string;
  /** Traefik labels; only used once the proxy network is joined after the health check. */
  labels: string[];
}

/**
 * Step 5: start the new version on the environment network ONLY. Traefik
 * routes to a labelled container the moment it joins warden-proxy, so the
 * proxy network is joined after the health check (see `goLive`).
 */
export async function startContainer(run: Run, s: StartSpec): Promise<void> {
  await removeContainer(run, s.name); // a leftover from an interrupted try
  const r = await run(
    [
      "docker run -d",
      `--name ${q(s.name)}`,
      "--restart unless-stopped",
      `--env-file ${q(s.envFile)}`,
      `--network ${q(s.network)}`,
      "--label warden=1",
      `--label ${q(`warden.service=${s.serviceId}`)}`,
      `--label ${q(`warden.deployment=${s.deploymentId}`)}`,
      ...s.labels,
      q(s.image),
    ].join(" "),
  );
  if (r.code !== 0) throw new Error(`Couldn't start the new version: ${(r.stderr || r.stdout).trim().split("\n")[0]}`);
}

async function state(run: Run, name: string): Promise<{ running: boolean; exitCode: number } | null> {
  const r = await run(`docker inspect --format '{{.State.Running}} {{.State.ExitCode}}' ${q(name)}`);
  if (r.code !== 0) return null;
  const [running, code] = r.stdout.trim().split(" ");
  return { running: running === "true", exitCode: Number(code) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Step 6 for an APPLICATION: open its health page from a tiny probe container
 * on the same network until it answers 2xx/3xx. Fails fast if the app exits.
 */
export async function healthCheckHttp(run: Run, log: DeployLog, o: { name: string; network: string; port: number; path: string; timeoutMs?: number }): Promise<void> {
  const probe = `${o.name}-probe`;
  const url = `http://${o.name}:${o.port}${o.path}`;
  await removeContainer(run, probe);
  const started = await run(`docker run -d --rm --name ${q(probe)} --network ${q(o.network)} --label warden=1 ${PROBE_IMAGE} sleep 900`);
  if (started.code !== 0) throw new Error(`Couldn't start the health check: ${started.stderr.trim().split("\n")[0]}`);
  try {
    const end = Date.now() + (o.timeoutMs ?? 90_000);
    let last = "";
    while (Date.now() < end) {
      const st = await state(run, o.name);
      if (!st?.running) {
        throw new Error(`The app stopped right after starting (exit code ${st?.exitCode ?? "?"}). Its last output:\n${await containerLogTail(run, o.name, 50)}`);
      }
      const r = await run(`docker exec ${q(probe)} sh -c ${q(`wget -S -q -T 3 -O /dev/null ${url} 2>&1 | grep -m1 'HTTP/' | awk '{print $2}'`)}`);
      const status = r.stdout.trim();
      if (/^[23]\d\d$/.test(status)) {
        log.say(`Health check passed: ${o.path} answered ${status}`);
        return;
      }
      // The default path is a loose check: any answer short of a server error
      // means the app is up (an API often has nothing at /, so it says 404).
      // A path someone set on purpose must really succeed.
      if (o.path === "/" && /^4\d\d$/.test(status)) {
        log.say(`Health check passed: the app answers (${o.path} said ${status}; set a health path in Settings for a stricter check)`);
        return;
      }
      if (status && status !== last) log.say(`Health check: ${o.path} answered ${status}, waiting for a 2xx/3xx…`);
      last = status;
      await sleep(2000);
    }
    throw new Error(
      `Nothing healthy answered at ${o.path} on port ${o.port} within 90 seconds. Does the app listen on 0.0.0.0:${o.port} (or $PORT)? Its last output:\n${await containerLogTail(run, o.name, 50)}`,
    );
  } finally {
    await removeContainer(run, probe);
  }
}

/** Step 6 for a WORKER (no web page): it must still be running after 10 seconds. */
export async function healthCheckRunning(run: Run, name: string): Promise<void> {
  await sleep(10_000);
  const st = await state(run, name);
  if (!st?.running) throw new Error(`The worker stopped right after starting (exit code ${st?.exitCode ?? "?"}). Its last output:\n${await containerLogTail(run, name, 50)}`);
}

/** The service's other app containers (older versions), running or not. */
export async function otherVersions(run: Run, serviceId: string, keep: string): Promise<string[]> {
  const r = await run(`docker ps -a --filter ${q(`label=warden.service=${serviceId}`)} --filter label=warden.deployment --format '{{.Names}}'`);
  return r.stdout
    .split("\n")
    .map((s) => s.trim())
    .filter((n) => n && n !== keep && !n.endsWith("-probe"));
}

/**
 * Step 7: the swap. The new version joins the proxy network (Traefik now
 * serves old and new together), then each old one is stopped politely:
 * SIGTERM, 10 seconds to finish its requests. Traefik's retry rule covers
 * requests that reach a version as it goes.
 */
export async function goLive(run: Run, log: DeployLog, o: { name: string; serviceId: string; web: boolean }): Promise<void> {
  if (o.web) {
    const c = await run(`docker network connect ${PROXY_NETWORK} ${q(o.name)}`);
    if (c.code !== 0 && !/already exists/i.test(c.stderr)) throw new Error(`Couldn't connect the new version to the proxy: ${c.stderr.trim()}`);
    // Joining a network isn't a CONTAINER event, and Traefik only re-reads
    // containers on container events: without this it keeps the address the
    // app had before (unreachable) and answers 504. Any container starting
    // makes it re-read everything (verified), so start a throwaway one.
    await run(`docker run --rm --label warden=1 ${PROBE_IMAGE} true`);
    await sleep(2000);
  }
  for (const old of await otherVersions(run, o.serviceId, o.name)) {
    log.say(`Stopping the previous version (${old})`);
    await run(`docker stop -t 10 ${q(old)}`);
    await removeContainer(run, old);
  }
}

/**
 * After the swap: ask Traefik itself for the app, the way a visitor would.
 * Only reported (the old version is already gone by now).
 */
export async function checkThroughProxy(run: Run, log: DeployLog, host: string, path: string): Promise<boolean> {
  const r = await run(
    `docker exec ${PROXY_CONTAINER} sh -c ${q(`wget -S -q -T 5 -O /dev/null --header 'Host: ${host}' http://127.0.0.1${path} 2>&1 | grep -m1 'HTTP/' | awk '{print $2}'`)}`,
  );
  const status = r.stdout.trim();
  const ok = /^[23]\d\d$/.test(status);
  log.say(ok ? `Visitors reach it: http://${host}${path} answers ${status}` : `Warning: through the proxy, http://${host}${path} answered ${status || "nothing"}`);
  return ok;
}

/** Step 8: keep the newest images (always including the live one); delete the rest. */
export async function pruneImages(run: Run, repo: string, liveTag: string): Promise<void> {
  const r = await run(`docker image ls ${q(repo)} --format '{{.Tag}}'`);
  const tags = r.stdout
    .split("\n")
    .map((t) => t.trim())
    .filter((t) => /^\d+$/.test(t))
    .sort((a, b) => Number(b) - Number(a));
  const keep = new Set([...tags.slice(0, KEEP_IMAGES), liveTag]);
  for (const t of tags) if (!keep.has(t)) await run(`docker rmi ${q(`${repo}:${t}`)}`);
}

export async function imageExists(run: Run, image: string): Promise<boolean> {
  return (await run(`docker image inspect ${q(image)} --format '{{.Id}}'`)).code === 0;
}

/** Free space where builds happen, in bytes. */
export async function freeBytes(run: Run, path: string): Promise<number | null> {
  const r = await run(`df -Pk ${q(path)} | tail -1 | awk '{print $4}'`);
  const kb = Number(r.stdout.trim());
  return Number.isFinite(kb) && kb > 0 ? kb * 1024 : null;
}
