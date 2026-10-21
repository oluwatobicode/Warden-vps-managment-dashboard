import { prisma, type DeploymentStatus, type Prisma } from "db";
import {
  containerLogTail,
  ensureNetwork,
  ensureVolume,
  healthStatus,
  pullImage,
  removeContainer,
  removeFile,
  removeVolume,
  restartContainer,
  runContainer,
  waitHealthy,
  writePrivateFile,
  type Run,
} from "docker-client";
import { DATABASE_CATALOG, type DatabaseJob } from "shared-types";
import { withSsh } from "ssh-client";
import { env } from "../env";
import { deleteObject } from "storage";
import { storageOf } from "../backups/storage";
import { COMMAND, envFileFor, HEALTH_CMD } from "../databases/engines";
import { sshTargetFor, unseal } from "../keys";
import { log } from "../log";
import { notify } from "../notify";

const WITH_EVERYTHING = {
  service: {
    include: {
      server: { include: { serverSshKey: { select: { privateKeyEncrypted: true } } } },
      environment: { include: { project: { select: { id: true, projectName: true } } } },
    },
  },
  organization: { select: { organizationName: true } },
} satisfies Prisma.ServiceDatabaseInclude;
type Db = Prisma.ServiceDatabaseGetPayload<{ include: typeof WITH_EVERYTHING }>;

/**
 * Create, restart or remove a database container on its server. The api has
 * already recorded what to do (ServiceDatabase + a QUEUED Deployment); this
 * follows it and writes each step to the deployment's history, which is
 * what people see as the log.
 */
export async function databaseJob(job: DatabaseJob): Promise<void> {
  const db = await prisma.serviceDatabase.findFirst({
    where: { serviceId: job.serviceId, organizationId: job.organizationId },
    include: WITH_EVERYTHING,
  });
  if (!db) return; // deleted in the meantime
  if (job.action === "remove") return remove(db, job.deleteData === true);
  if (!job.deploymentId) return;
  return deploy(db, job.deploymentId, job.action === "provision");
}

async function deploy(db: Db, deploymentId: string, isNew: boolean): Promise<void> {
  const server = db.service.server;
  const step = (status: DeploymentStatus, message: string) => record(deploymentId, status, message);
  const started = new Date();
  await prisma.deployment.update({ where: { id: deploymentId }, data: { startedAt: started } });

  try {
    if (!server) throw new Error("The database has no server");
    await step("DEPLOYING", `Connecting to ${server.serverName}`);
    const target = await sshTargetFor({ ...server, organizationId: db.organizationId });
    await withSsh(target, async (run) => {
      try {
        if (!isNew && (await healthStatus(run, db.containerName)) !== "missing") {
          await step("DEPLOYING", "Restarting the container");
          await restartContainer(run, db.containerName);
        } else {
          if (!isNew) await step("DEPLOYING", "The container was missing; recreating it with the existing data");
          await start(run, db, step);
        }
        await step("HEALTH_CHECK", "Waiting for the database to answer");
        await waitHealthy(run, db.containerName);
      } catch (e) {
        // Leave nothing half-made. A brand-new volume is empty, so it goes too;
        // an existing one holds data and always stays.
        const tail = await containerLogTail(run, db.containerName).catch(() => "");
        if (isNew) {
          await removeContainer(run, db.containerName);
          await removeVolume(run, db.volumeName).catch(() => undefined);
        }
        throw new Error(`${(e as Error).message}${tail ? `\n\nLast lines from the container:\n${tail}` : ""}`);
      }
    });

    await prisma.$transaction([
      prisma.deployment.update({ where: { id: deploymentId }, data: { deploymentStatus: "SUCCESS", finishedAt: new Date() } }),
      prisma.deploymentHistory.create({ data: { deploymentId, status: "SUCCESS", message: "Live" } }),
      prisma.service.update({ where: { id: db.serviceId }, data: { status: "HEALTHY" } }),
    ]);
    log.info(`database ${db.service.serviceName} (${db.engine} ${db.version}) is live`);
    await notifyDeploy(db, deploymentId, "deploy.succeeded", started, null);
  } catch (e) {
    const reason = (e as Error).message;
    log.warn(`database ${db.service.serviceName}: ${reason.split("\n")[0]}`);
    await prisma.$transaction([
      prisma.deployment.update({ where: { id: deploymentId }, data: { deploymentStatus: "FAILED", finishedAt: new Date() } }),
      prisma.deploymentHistory.create({ data: { deploymentId, status: "FAILED", message: reason.slice(0, 4000) } }),
      prisma.service.update({ where: { id: db.serviceId }, data: { status: "FAILED" } }),
    ]);
    await notifyDeploy(db, deploymentId, "deploy.failed", started, reason.split("\n")[0]);
  }
}

/** Network, volume, image, then the container. The env file exists only while `docker run` reads it. */
async function start(run: Run, db: Db, step: (s: DeploymentStatus, m: string) => Promise<void>) {
  const spec = DATABASE_CATALOG[db.engine];
  const image = `${spec.image}:${db.version}`;
  await step("DEPLOYING", `Preparing private network ${db.networkName}`);
  await ensureNetwork(run, db.networkName);
  await ensureVolume(run, db.volumeName);
  await step("DEPLOYING", `Downloading ${image} (the first time can take a minute)`);
  await pullImage(run, image);

  const password = await unseal(db.organizationId, db.passwordEncrypted);
  const rootPassword = db.rootPasswordEncrypted ? await unseal(db.organizationId, db.rootPasswordEncrypted) : null;
  const envFile = `/tmp/warden-${db.containerName}.env`;
  await step("DEPLOYING", `Starting ${db.containerName}`);
  await writePrivateFile(run, envFile, envFileFor(db.engine, { password, rootPassword, databaseName: db.databaseName, username: db.username }));
  try {
    await removeContainer(run, db.containerName); // a leftover from an earlier try
    await runContainer(run, {
      name: db.containerName,
      image,
      network: db.networkName,
      volume: db.volumeName,
      dataPath: spec.dataPath(db.version),
      envFile,
      healthCmd: HEALTH_CMD[db.engine],
      command: COMMAND[db.engine],
      labels: { "warden.service": db.serviceId, "warden.org": db.organizationId },
    });
  } finally {
    await removeFile(run, envFile);
  }
}

/** Remove the container (and the data only when asked), then the rows. */
async function remove(db: Db, deleteData: boolean): Promise<void> {
  const server = db.service.server;
  try {
    if (server) {
      const target = await sshTargetFor({ ...server, organizationId: db.organizationId });
      await withSsh(target, async (run) => {
        await removeContainer(run, db.containerName);
        if (deleteData) await removeVolume(run, db.volumeName);
      });
    }
    // The backup rows go with the database (cascade), so their files must go
    // first or they'd sit in the bucket with nothing pointing at them.
    const backups = await prisma.databaseBackup.findMany({ where: { serviceId: db.serviceId, objectKey: { not: null } } });
    for (const b of backups) {
      const t = await storageOf(db.organizationId, b.storage, b.bucket);
      if (t) await deleteObject(t, b.objectKey!).catch(() => undefined);
    }
    await prisma.$transaction([
      ...(db.environmentVariableId ? [prisma.environmentVariable.deleteMany({ where: { id: db.environmentVariableId, organizationId: db.organizationId } })] : []),
      prisma.service.delete({ where: { id: db.serviceId } }),
    ]);
    log.info(`database ${db.service.serviceName} removed${deleteData ? " with its data" : " (data volume kept)"}`);
  } catch (e) {
    // Server unreachable or Docker refused: keep the rows so it can be retried.
    log.warn(`database ${db.service.serviceName}: remove failed: ${(e as Error).message}`);
    await prisma.service.update({ where: { id: db.serviceId }, data: { status: "FAILED" } });
  }
}

async function record(deploymentId: string, status: DeploymentStatus, message: string) {
  await prisma.$transaction([
    prisma.deployment.update({ where: { id: deploymentId }, data: { deploymentStatus: status } }),
    prisma.deploymentHistory.create({ data: { deploymentId, status, message } }),
  ]);
}

async function notifyDeploy(db: Db, deploymentId: string, event: "deploy.succeeded" | "deploy.failed", startedAt: Date, reason: string | null) {
  const dep = await prisma.deployment.findUnique({ where: { id: deploymentId }, select: { number: true, triggeredByName: true, commitMessage: true, finishedAt: true } });
  const project = db.service.environment.project;
  await notify(db.organizationId, event, {
    organizationName: db.organization.organizationName,
    projectName: project.projectName,
    environmentName: db.service.environment.environmentName,
    serviceName: db.service.serviceName,
    deploymentNumber: dep?.number ?? 0,
    commitMessage: dep?.commitMessage,
    triggeredBy: dep?.triggeredByName,
    serverName: db.service.server?.serverName,
    startedAt,
    finishedAt: dep?.finishedAt,
    reason,
    url: env.APP_URL ? `${env.APP_URL.replace(/\/$/, "")}/projects/${project.id}/services/${db.serviceId}` : undefined,
  });
}
