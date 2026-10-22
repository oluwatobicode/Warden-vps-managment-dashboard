import { prisma, type DeploymentStatus, type Prisma } from "db";
import { q, type Run } from "docker-client";
import { shortId, sslipHost, type DeployJob, type ProxyJob } from "shared-types";
import { withSsh, type Stream } from "ssh-client";
import { env } from "../env";
import { sshTargetFor } from "../keys";
import { log as workerLog } from "../log";
import { notify } from "../notify";
import { redis } from "../redis";
import { DeployLog } from "../deploys/logger";
import { routeLabels, setupProxy, proxyRunning } from "../deploys/traefik";
import { buildDockerfile, clone, hasDockerfile } from "../deploys/source";
import { buildRailpack } from "../deploys/railpack";
import { installationToken } from "../deploys/github";
import {
  appVariables,
  checkThroughProxy,
  freeBytes,
  goLive,
  healthCheckHttp,
  healthCheckRunning,
  imageExists,
  pruneImages,
  releaseCommand,
  startContainer,
  withEnvFile,
} from "../deploys/runtime";

/*
 * One deploy, steps 0–8 of docs/PHASE-2-DEPLOY-PLAN.md. The rule everything
 * hangs on: the old version keeps serving until the new one is healthy, so
 * any failure here leaves the live app untouched.
 */

const WITH_ALL = {
  service: {
    include: {
      server: { include: { serverSshKey: { select: { privateKeyEncrypted: true } } } },
      environment: { include: { project: { select: { id: true, projectName: true } } } },
      githubInstallation: true,
      domains: true,
    },
  },
  rollbackOf: { select: { number: true, imageTag: true, commitSha: true, buildMethod: true, branch: true } },
  organization: { select: { organizationName: true } },
} satisfies Prisma.DeploymentInclude;
type Dep = Prisma.DeploymentGetPayload<{ include: typeof WITH_ALL }>;

/** Builds must leave at least this much disk free (checked before starting). */
const MIN_FREE_BYTES = 2 * 1024 ** 3;
const LOCK_TTL_MS = 25 * 60 * 1000;
const lockKey = (serverId: string) => `deploy-lock:${serverId}`;
/** Set by the api's Cancel button; checked between steps. */
const cancelKey = (deploymentId: string) => `deploy-cancel:${deploymentId}`;

class DeployFailure extends Error {
  constructor(
    message: string,
    readonly status: DeploymentStatus = "FAILED",
  ) {
    super(message);
  }
}

export async function deployJob(job: DeployJob): Promise<void> {
  const dep = await prisma.deployment.findFirst({ where: { id: job.deploymentId, organizationId: job.organizationId }, include: WITH_ALL });
  if (!dep || dep.deploymentStatus !== "QUEUED") return; // cancelled, or already handled
  const log = new DeployLog(dep.id);
  const startedAt = new Date();
  const step = async (status: DeploymentStatus, message: string) => {
    // A step is where a deploy can stop cleanly: before it, nothing of this step happened.
    if (await redis.exists(cancelKey(dep.id))) throw new DeployFailure("Cancelled. The live version wasn't changed", "CANCELLED");
    log.say(message);
    await prisma.$transaction([
      prisma.deployment.update({ where: { id: dep.id }, data: { deploymentStatus: status } }),
      prisma.deploymentHistory.create({ data: { deploymentId: dep.id, status, message } }),
    ]);
  };

  const server = dep.service.server;
  let locked = false;
  let renew: NodeJS.Timeout | undefined;
  try {
    if (!server) throw new DeployFailure("The service has no server. Pick one in its Settings");
    if (server.serverType !== "DEPLOY") throw new DeployFailure("Apps run on DEPLOY servers only");

    // One build per server at a time: a small server can't do two at once.
    for (let waited = false; ; waited = true) {
      if ((await redis.set(lockKey(server.id), dep.id, "PX", LOCK_TTL_MS, "NX")) === "OK") break;
      if (!waited) await step("QUEUED", `Waiting for another deploy on ${server.serverName} to finish`);
      if (await redis.exists(cancelKey(dep.id))) throw new DeployFailure("Cancelled while waiting. The live version wasn't changed", "CANCELLED");
      await new Promise((r) => setTimeout(r, 3000));
    }
    locked = true;
    renew = setInterval(() => void redis.pexpire(lockKey(server.id), LOCK_TTL_MS), 60_000);

    await prisma.deployment.update({ where: { id: dep.id }, data: { startedAt } });
    await prisma.service.update({ where: { id: dep.serviceId }, data: { status: "DEPLOYING" } });
    await step("BUILDING", `Connecting to ${server.serverName}`);

    const target = await sshTargetFor({ ...server, organizationId: dep.organizationId });
    await withSsh(target, (run, stream) => runDeploy(dep, run, stream, log, step));

    await prisma.$transaction([
      prisma.deployment.update({ where: { id: dep.id }, data: { deploymentStatus: "SUCCESS", finishedAt: new Date() } }),
      prisma.deploymentHistory.create({ data: { deploymentId: dep.id, status: "SUCCESS", message: "Live" } }),
      prisma.service.update({ where: { id: dep.serviceId }, data: { status: "HEALTHY" } }),
    ]);
    log.say("Live");
    workerLog.info(`deploy #${dep.number} of ${dep.service.serviceName} is live`);
    await notifyDeploy(dep, "deploy.succeeded", startedAt, null);
  } catch (e) {
    const failure = e instanceof DeployFailure ? e : new DeployFailure((e as Error).message);
    log.say(`Failed: ${failure.message}`);
    workerLog.warn(`deploy #${dep.number} of ${dep.service.serviceName} failed: ${failure.message.split("\n")[0]}`);
    // The old version (if any) never stopped, so the service is still what it was.
    const stillLive = await prisma.deployment.findFirst({
      where: { serviceId: dep.serviceId, deploymentStatus: "SUCCESS", id: { not: dep.id } },
      select: { id: true },
    });
    await prisma.$transaction([
      prisma.deployment.update({ where: { id: dep.id }, data: { deploymentStatus: failure.status, finishedAt: new Date() } }),
      prisma.deploymentHistory.create({ data: { deploymentId: dep.id, status: failure.status, message: failure.message.slice(0, 4000) } }),
      prisma.service.update({ where: { id: dep.serviceId }, data: { status: stillLive ? "HEALTHY" : "FAILED" } }),
    ]);
    const event = failure.status === "CANCELLED" ? "deploy.cancelled" : failure.status === "GATE_FAILED" ? "deploy.gate_failed" : "deploy.failed";
    await notifyDeploy(dep, event, startedAt, failure.message.split("\n")[0]);
  } finally {
    await redis.del(cancelKey(dep.id));
    if (renew) clearInterval(renew);
    if (locked && server && (await redis.get(lockKey(server.id))) === dep.id) await redis.del(lockKey(server.id));
    await log.close();
  }
}

async function runDeploy(dep: Dep, run: Run, stream: Stream, log: DeployLog, step: (s: DeploymentStatus, m: string) => Promise<void>) {
  const svc = dep.service;
  const server = svc.server!;
  const web = svc.type === "APPLICATION";
  if (svc.type !== "APPLICATION" && svc.type !== "WORKER") throw new DeployFailure("Only applications and workers are deployed this way");
  if (web && svc.port == null) throw new DeployFailure("An application needs a port. Set it in the service's Settings");
  if (web && !(await proxyRunning(run))) throw new DeployFailure(`The proxy isn't set up on ${server.serverName}. Press "Set up proxy" on the server's page first`);

  const repo = `warden/${shortId(svc.id)}`;
  const tag = `${repo}:${dep.number}`;
  const name = `warden-app-${shortId(svc.id)}-${dep.number}`;
  const network = `warden-env-${shortId(svc.environmentId)}`;
  const home = (await run("printf %s \"$HOME\"")).stdout.trim() || "/tmp";
  const base = `${home}/.warden`;
  const dir = `${base}/builds/${dep.id}`;
  const envFile = `${base}/env-${dep.id}`;

  // Step 1: room to work.
  await run(`mkdir -p ${q(`${base}/builds`)} && chmod 700 ${q(base)}`);
  const free = await freeBytes(run, base);
  if (free != null && free < MIN_FREE_BYTES) {
    throw new DeployFailure(`Only ${(free / 1024 ** 3).toFixed(1)} GB of disk is free on ${server.serverName}; a build needs at least 2 GB. Run Docker cleanup on the server's page, then deploy again`);
  }
  await run(`docker network inspect ${q(network)} >/dev/null 2>&1 || docker network create --label warden=1 ${q(network)}`);

  try {
    // Steps 2–3: the image. A rollback reuses its kept image when it can.
    const reuse = dep.rollbackOf?.imageTag && (await imageExists(run, dep.rollbackOf.imageTag)) ? dep.rollbackOf.imageTag : null;
    if (reuse) {
      await step("BUILDING", `Reusing the image of #${dep.rollbackOf!.number} (no rebuild)`);
      await run(`docker tag ${q(reuse)} ${q(tag)}`);
      await prisma.deployment.update({ where: { id: dep.id }, data: { imageTag: tag, buildMethod: dep.rollbackOf!.buildMethod } });
    } else if (svc.githubRepoUrl) {
      const ref = dep.rollbackOf?.commitSha ?? dep.commitSha ?? dep.branch ?? svc.branch ?? svc.environment.branch ?? "main";
      await step("BUILDING", `Getting the code (${svc.githubRepoUrl.replace("https://github.com/", "")} @ ${ref.length === 40 ? ref.slice(0, 7) : ref})`);
      const token = svc.githubInstallation ? await installationToken(svc.githubInstallation.installationId) : undefined;
      const commit = await clone(run, stream, log, { dir, repoUrl: svc.githubRepoUrl, ref, token });
      await prisma.deployment.update({ where: { id: dep.id }, data: { commitSha: commit.sha || null, commitMessage: dep.commitMessage ?? (commit.message || null) } });

      const contextDir = svc.rootDirectory ? `${dir}/${svc.rootDirectory}` : dir;
      if (await hasDockerfile(run, contextDir, svc.dockerfilePath)) {
        await step("BUILDING", `Building with ${svc.dockerfilePath}`);
        await buildDockerfile(stream, log, { contextDir, dockerfilePath: svc.dockerfilePath, tag, serviceId: svc.id });
        await prisma.deployment.update({ where: { id: dep.id }, data: { imageTag: tag, buildMethod: "DOCKERFILE" } });
      } else {
        await step("BUILDING", `No ${svc.dockerfilePath} found, so Railpack works out how to build it`);
        const vars = await appVariables({ ...ids(svc), port: svc.port }, log);
        await buildRailpack(run, stream, log, { contextDir, tag, serviceId: svc.id, buildCommand: svc.buildCommand, startCommand: svc.startCommand, staticOutputDir: svc.staticOutputDir, vars, home: base });
        await prisma.deployment.update({ where: { id: dep.id }, data: { imageTag: tag, buildMethod: "RAILPACK" } });
      }
    } else if (svc.image) {
      await step("BUILDING", `Downloading ${svc.image}`);
      const p = await run(`docker pull -q ${q(svc.image)} && docker tag ${q(svc.image)} ${q(tag)}`);
      if (p.code !== 0) throw new DeployFailure(`Couldn't download ${svc.image}: ${(p.stderr || p.stdout).trim().split("\n")[0]}`);
      await prisma.deployment.update({ where: { id: dep.id }, data: { imageTag: tag } });
    } else {
      throw new DeployFailure("The service has no GitHub repo or image to deploy. Set one in its Settings");
    }

    const vars = await appVariables({ ...ids(svc), port: svc.port }, log);
    await withEnvFile(run, envFile, vars, async () => {
      // Step 4: the release command, before anything goes live.
      if (svc.releaseCommand) {
        await step("DEPLOYING", `Running the release command: ${svc.releaseCommand}`);
        await releaseCommand(stream, log, { image: tag, envFile, network, command: svc.releaseCommand, name: `${name}-release` });
      }
      // Step 5: start next to the old version.
      await step("DEPLOYING", `Starting ${name}`);
      const hosts = web ? [sslipHost(svc, server.serverIp)] : [];
      const httpsHosts = web ? svc.domains.map((d) => d.domain) : [];
      const labels = web ? routeLabels({ router: `svc-${shortId(svc.id)}`, port: svc.port!, hosts, httpsHosts }) : [];
      await startContainer(run, { name, image: tag, envFile, network, serviceId: svc.id, deploymentId: dep.id, labels });
    });
    await prisma.deployment.update({ where: { id: dep.id }, data: { containerName: name } });

    // Step 6: healthy?
    try {
      if (web) {
        await step("HEALTH_CHECK", `Checking ${svc.healthCheckPath} on port ${svc.port}`);
        await healthCheckHttp(run, log, { name, network, port: svc.port!, path: svc.healthCheckPath });
      } else {
        await step("HEALTH_CHECK", "Checking it keeps running");
        await healthCheckRunning(run, name);
      }
    } catch (e) {
      await run(`docker rm -f ${q(name)}`);
      throw new DeployFailure((e as Error).message, "GATE_FAILED");
    }

    // Steps 7–8: swap, then tidy up.
    await step("DEPLOYING", web ? "Switching visitors to the new version" : "Replacing the previous version");
    await goLive(run, log, { name, serviceId: svc.id, web });
    if (web) await checkThroughProxy(run, log, svc.domains[0]?.domain ?? sslipHost(svc, server.serverIp), svc.healthCheckPath);
    await pruneImages(run, repo, String(dep.number));
  } catch (e) {
    // Whatever failed before the swap: the new container must not linger.
    await run(`docker rm -f ${q(name)} ${q(`${name}-release`)} ${q(`${name}-probe`)} >/dev/null 2>&1`);
    await run(`docker rmi ${q(tag)} >/dev/null 2>&1`);
    throw e;
  } finally {
    await run(`rm -rf ${q(dir)} ${q(envFile)}`);
  }
}

const ids = (svc: Dep["service"]) => ({ organizationId: svc.organizationId, environmentId: svc.environmentId, serviceId: svc.id });

async function notifyDeploy(dep: Dep, event: "deploy.succeeded" | "deploy.failed" | "deploy.gate_failed" | "deploy.cancelled", startedAt: Date, reason: string | null) {
  const d = await prisma.deployment.findUnique({ where: { id: dep.id }, select: { commitSha: true, commitMessage: true, finishedAt: true } });
  const project = dep.service.environment.project;
  await notify(dep.organizationId, event, {
    organizationName: dep.organization.organizationName,
    projectName: project.projectName,
    environmentName: dep.service.environment.environmentName,
    serviceName: dep.service.serviceName,
    deploymentNumber: dep.number,
    branch: dep.branch,
    commitSha: d?.commitSha,
    commitMessage: d?.commitMessage,
    triggeredBy: dep.triggeredByName,
    serverName: dep.service.server?.serverName,
    startedAt,
    finishedAt: d?.finishedAt,
    reason,
    url: env.APP_URL ? `${env.APP_URL.replace(/\/$/, "")}/projects/${project.id}/services/${dep.serviceId}` : undefined,
  });
}

/** "Set up proxy" on a server: start Traefik there and remember it. */
export async function proxyJob(job: ProxyJob): Promise<void> {
  const server = await prisma.server.findFirst({
    where: { id: job.serverId, organizationId: job.organizationId },
    include: { serverSshKey: { select: { privateKeyEncrypted: true } } },
  });
  if (!server) return;
  const target = await sshTargetFor({ ...server, organizationId: server.organizationId });
  await withSsh(target, (run) => setupProxy(run));
  await prisma.server.update({ where: { id: server.id }, data: { proxyInstalledAt: new Date() } });
  workerLog.info(`proxy set up on ${server.serverName}`);
}

/**
 * Hourly: deploy logs older than 30 days go, and deploys stuck in progress
 * for over 45 minutes (the worker died mid-deploy) are marked failed. Their
 * half-started containers are removed on the service's next deploy.
 */
export async function deployPrune(): Promise<void> {
  const logs = await prisma.deploymentLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 30 * 24 * 3600 * 1000) } } });
  const stuck = await prisma.deployment.findMany({
    where: { deploymentStatus: { in: ["QUEUED", "BUILDING", "DEPLOYING", "HEALTH_CHECK"] }, createdAt: { lt: new Date(Date.now() - 45 * 60 * 1000) } },
    select: { id: true, serviceId: true },
  });
  for (const d of stuck) {
    const live = await prisma.deployment.findFirst({ where: { serviceId: d.serviceId, deploymentStatus: "SUCCESS" }, select: { id: true } });
    await prisma.$transaction([
      prisma.deployment.update({ where: { id: d.id }, data: { deploymentStatus: "FAILED", finishedAt: new Date() } }),
      prisma.deploymentHistory.create({ data: { deploymentId: d.id, status: "FAILED", message: "Interrupted (the worker stopped mid-deploy). The live version wasn't changed" } }),
      prisma.service.update({ where: { id: d.serviceId }, data: { status: live ? "HEALTHY" : "FAILED" } }),
    ]);
  }
  if (logs.count || stuck.length) workerLog.info(`deploy prune: ${logs.count} old log chunk(s), ${stuck.length} stuck deploy(s)`);
}
