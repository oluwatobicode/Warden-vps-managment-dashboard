import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { resolve4 } from 'node:dns/promises';
import { listRepos } from 'github-app';
import type { Prisma } from 'db';
import {
  DEPLOY_JOBS,
  sslipHost,
  type AddDomainInput,
  type DeployInfo,
  type ServiceDomain,
  type DeployJob,
  type DeployLogChunk,
  type Deployment,
  type DeploymentDetail,
  type TriggerDeployInput,
  type UpdateDeploySettingsInput,
} from 'shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { DEPLOY_MESSAGES } from '../../common/constants/messages.config';
import type { Actor } from '../../common/types/actor';
import { createDeployment } from './deployment-counter';
import { DEPLOY_QUEUE } from './deploy.queue';
import { GithubConfig } from './github.config';

const IN_PROGRESS = ['QUEUED', 'BUILDING', 'DEPLOYING', 'HEALTH_CHECK'] as const;
/** The worker checks this between steps (see apps/worker/src/jobs/deploy.ts). */
export const cancelKey = (deploymentId: string) => `deploy-cancel:${deploymentId}`;

type DeploymentRow = Prisma.DeploymentGetPayload<{
  include: { rollbackOf: { select: { number: true } } };
}>;

/**
 * App deploys (docs/PHASE-2-DEPLOY-PLAN.md). The api decides and records; the
 * worker does steps 1–8 on the server. Developer and up deploy, roll back and
 * cancel; DevOps and up set up the proxy.
 */
@Injectable()
export class DeployService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly github: GithubConfig,
    @Inject(DEPLOY_QUEUE) private readonly queue: Queue,
  ) {}

  // ── deploy, rollback, cancel ───────────────────────────────────────────

  async trigger(actor: Actor, input: TriggerDeployInput): Promise<Deployment> {
    const svc = await this.deployable(actor.organizationId, input.serviceId);
    const dep = await this.queueDeploy(svc, {
      triggeredById: actor.userId,
      triggeredByName: await this.actorName(actor),
      commitSha: input.commitSha ?? null,
      message: null,
    });
    await this.audit.record(actor, {
      action: 'deploy.triggered',
      entityType: 'deployment',
      entityId: dep.id,
      metadata: { service: svc.serviceName, number: dep.number },
      projectId: svc.environment.projectId,
    });
    return this.one(actor.organizationId, dep.id);
  }

  /**
   * Bring back an older version: a NEW deployment that reuses that one's
   * image if the server still has it (instant), or rebuilds its commit.
   * Database changes and variables are NOT rolled back (the UI says so).
   */
  async rollback(actor: Actor, deploymentId: string): Promise<Deployment> {
    const orgId = actor.organizationId;
    const target = await this.prisma.client.deployment.findFirst({
      where: { id: deploymentId, organizationId: orgId },
    });
    if (!target) throw new NotFoundException(DEPLOY_MESSAGES.not_found);
    if (target.deploymentStatus !== 'SUCCESS') {
      throw new BadRequestException(DEPLOY_MESSAGES.rollback_not_success);
    }
    if ((await this.liveId(target.serviceId)) === target.id) {
      throw new BadRequestException(DEPLOY_MESSAGES.rollback_is_live);
    }
    const svc = await this.deployable(orgId, target.serviceId);
    const dep = await this.queueDeploy(svc, {
      triggeredById: actor.userId,
      triggeredByName: await this.actorName(actor),
      commitSha: target.commitSha,
      branch: target.branch,
      message: `Rollback to #${target.number}`,
      rollbackOfId: target.id,
    });
    await this.audit.record(actor, {
      action: 'deploy.rolled_back',
      entityType: 'deployment',
      entityId: dep.id,
      metadata: { service: svc.serviceName, number: dep.number, to: target.number },
      projectId: svc.environment.projectId,
    });
    return this.one(orgId, dep.id);
  }

  /**
   * A queued deploy stops at once. A running one stops after the step it's on
   * (the worker checks between steps); the live version is never touched.
   */
  async cancel(actor: Actor, deploymentId: string): Promise<{ message: string }> {
    const orgId = actor.organizationId;
    const dep = await this.prisma.client.deployment.findFirst({
      where: { id: deploymentId, organizationId: orgId },
      include: { service: { select: { serviceName: true, environment: { select: { projectId: true } } } } },
    });
    if (!dep) throw new NotFoundException(DEPLOY_MESSAGES.not_found);
    if (!(IN_PROGRESS as readonly string[]).includes(dep.deploymentStatus)) {
      throw new BadRequestException(DEPLOY_MESSAGES.cancel_not_running);
    }
    let message: string = DEPLOY_MESSAGES.cancel_running;
    // Only QUEUED → CANCELLED here; if the worker already picked it up, the flag does it.
    const { count } = await this.prisma.client.deployment.updateMany({
      where: { id: dep.id, deploymentStatus: 'QUEUED', startedAt: null },
      data: { deploymentStatus: 'CANCELLED', finishedAt: new Date() },
    });
    if (count) {
      await this.prisma.client.deploymentHistory.create({
        data: { deploymentId: dep.id, status: 'CANCELLED', message: 'Cancelled before it started' },
      });
      message = 'Cancelled';
    } else {
      await this.redis.set(cancelKey(dep.id), '1', 'EX', 3600);
    }
    await this.audit.record(actor, {
      action: 'deploy.cancelled',
      entityType: 'deployment',
      entityId: dep.id,
      metadata: { service: dep.service.serviceName, number: dep.number },
      projectId: dep.service.environment.projectId,
    });
    return { message };
  }

  /** Used by the GitHub webhook: a push to the service's branch. */
  async triggerFromPush(
    serviceId: string,
    orgId: string,
    push: { sha: string; message: string | null; pusher: string; branch: string },
  ): Promise<void> {
    const svc = await this.deployable(orgId, serviceId).catch(() => null);
    if (!svc) return;
    await this.queueDeploy(svc, {
      triggeredById: null,
      triggeredByName: `push by ${push.pusher}`,
      commitSha: push.sha,
      branch: push.branch,
      message: push.message,
      type: 'AUTOMATED',
    }).catch(() => undefined); // already deploying: the running deploy wins
  }

  // ── reading ────────────────────────────────────────────────────────────

  async list(orgId: string, serviceId: string): Promise<Deployment[]> {
    await this.serviceOf(orgId, serviceId);
    const [rows, live] = await Promise.all([
      this.prisma.client.deployment.findMany({
        where: { serviceId, organizationId: orgId },
        include: { rollbackOf: { select: { number: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.liveId(serviceId),
    ]);
    return rows.map((r) => this.toDto(r, live));
  }

  async detail(orgId: string, deploymentId: string): Promise<DeploymentDetail> {
    const r = await this.prisma.client.deployment.findFirst({
      where: { id: deploymentId, organizationId: orgId },
      include: {
        rollbackOf: { select: { number: true } },
        service: { select: { serviceName: true } },
        history: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!r) throw new NotFoundException(DEPLOY_MESSAGES.not_found);
    return {
      ...this.toDto(r, await this.liveId(r.serviceId)),
      serviceId: r.serviceId,
      serviceName: r.service.serviceName,
      history: r.history.map((h) => ({
        status: h.status,
        message: h.message,
        at: h.createdAt.toISOString(),
      })),
    };
  }

  /** The saved output, after a given chunk (a reconnecting viewer asks for what it missed). */
  async logs(orgId: string, deploymentId: string, afterSeq = 0): Promise<DeployLogChunk[]> {
    await this.assertDeployment(orgId, deploymentId);
    const rows = await this.prisma.client.deploymentLog.findMany({
      where: { deploymentId, seq: { gt: afterSeq } },
      orderBy: { seq: 'asc' },
      take: 2000,
      select: { seq: true, text: true },
    });
    return rows;
  }

  /** For the live log gateway: does this deployment belong to the org? */
  async assertDeployment(orgId: string, deploymentId: string): Promise<void> {
    const ok = await this.prisma.client.deployment.findFirst({
      where: { id: deploymentId, organizationId: orgId },
      select: { id: true },
    });
    if (!ok) throw new NotFoundException(DEPLOY_MESSAGES.not_found);
  }

  // ── settings ───────────────────────────────────────────────────────────

  async info(orgId: string, serviceId: string): Promise<DeployInfo> {
    const s = await this.prisma.client.service.findFirst({
      where: { id: serviceId, organizationId: orgId },
      include: { server: { select: { serverIp: true, proxyInstalledAt: true } }, domains: true },
    });
    if (!s) throw new NotFoundException(DEPLOY_MESSAGES.service_not_found);
    const web = s.type === 'APPLICATION' && s.server;
    return {
      settings: {
        rootDirectory: s.rootDirectory,
        dockerfilePath: s.dockerfilePath,
        buildCommand: s.buildCommand,
        startCommand: s.startCommand,
        releaseCommand: s.releaseCommand,
        staticOutputDir: s.staticOutputDir,
        healthCheckPath: s.healthCheckPath,
        watchPaths: s.watchPaths,
        autoDeploy: s.autoDeploy,
        githubInstallationId: s.githubInstallationId,
        githubRepoId: s.githubRepoId,
      },
      domains: s.domains.map((d) => this.domainDto(d)),
      serverIp: s.server?.serverIp ?? null,
      url: web
        ? s.domains[0]
          ? `https://${s.domains[0].domain}`
          : `http://${sslipHost(s, s.server!.serverIp)}`
        : null,
      proxyReady: !!s.server?.proxyInstalledAt,
    };
  }

  async updateSettings(actor: Actor, serviceId: string, input: UpdateDeploySettingsInput): Promise<DeployInfo> {
    const orgId = actor.organizationId;
    const svc = await this.serviceOf(orgId, serviceId);
    const data: Prisma.ServiceUncheckedUpdateInput = {
      rootDirectory: input.rootDirectory,
      dockerfilePath: input.dockerfilePath,
      buildCommand: input.buildCommand === undefined ? undefined : input.buildCommand || null,
      startCommand: input.startCommand === undefined ? undefined : input.startCommand || null,
      releaseCommand: input.releaseCommand === undefined ? undefined : input.releaseCommand || null,
      staticOutputDir: input.staticOutputDir === undefined ? undefined : input.staticOutputDir || null,
      healthCheckPath: input.healthCheckPath,
      watchPaths: input.watchPaths,
      autoDeploy: input.autoDeploy,
    };
    // Picking a repo through the App: the installation must be this org's, and
    // the App must really see that repo. The clone URL comes from GitHub, not the body.
    if (input.githubInstallationId !== undefined || input.githubRepoId !== undefined) {
      if (!input.githubInstallationId || !input.githubRepoId) {
        data.githubInstallationId = null;
        data.githubRepoId = null;
      } else {
        const inst = await this.prisma.client.githubInstallation.findFirst({
          where: { id: input.githubInstallationId, organizationId: orgId },
        });
        if (!inst) throw new BadRequestException(DEPLOY_MESSAGES.installation_not_found);
        const repo = (await listRepos(this.github.require(), inst.installationId)).find(
          (r) => r.id === input.githubRepoId,
        );
        if (!repo) throw new BadRequestException(DEPLOY_MESSAGES.repo_not_visible);
        data.githubInstallationId = inst.id;
        data.githubRepoId = repo.id;
        data.githubRepoUrl = repo.htmlUrl;
        if (!svc.branch) data.branch = repo.defaultBranch;
      }
    }
    await this.prisma.client.service.update({ where: { id: serviceId }, data });
    await this.audit.record(actor, {
      action: 'deploy_settings.updated',
      entityType: 'service',
      entityId: serviceId,
      metadata: { service: svc.serviceName, fields: Object.keys(input).join(', ') },
      projectId: svc.environment.projectId,
    });
    return this.info(orgId, serviceId);
  }

  // ── custom domains (HTTPS via Let's Encrypt) ───────────────────────────

  /**
   * Add a domain. It's used from the NEXT deploy (Traefik reads a container's
   * names when it starts). Its DNS is checked straight away and can be
   * re-checked; an unverified domain is still added, because DNS can take a
   * while to update.
   */
  async addDomain(actor: Actor, input: AddDomainInput): Promise<ServiceDomain> {
    const orgId = actor.organizationId;
    const svc = await this.serviceOf(orgId, input.serviceId);
    if (svc.type !== 'APPLICATION') throw new BadRequestException(DEPLOY_MESSAGES.domain_web_only);
    if (!svc.server) throw new BadRequestException(DEPLOY_MESSAGES.domain_no_server);
    const taken = await this.prisma.client.serviceDomain.findUnique({ where: { domain: input.domain } });
    if (taken) throw new ConflictException(DEPLOY_MESSAGES.domain_taken);
    const row = await this.prisma.client.serviceDomain.create({
      data: { serviceId: svc.id, organizationId: orgId, domain: input.domain },
    });
    await this.audit.record(actor, {
      action: 'deploy_settings.updated',
      entityType: 'service',
      entityId: svc.id,
      metadata: { service: svc.serviceName, domainAdded: input.domain },
      projectId: svc.environment.projectId,
    });
    return this.verifyDomain(orgId, row.id);
  }

  /** Does the domain's DNS point at the service's server? (A records, CNAMEs followed.) */
  async verifyDomain(orgId: string, id: string): Promise<ServiceDomain & { dnsIps: string[] }> {
    const row = await this.prisma.client.serviceDomain.findFirst({
      where: { id, organizationId: orgId },
      include: { service: { select: { server: { select: { serverIp: true } } } } },
    });
    if (!row) throw new NotFoundException(DEPLOY_MESSAGES.domain_not_found);
    const ips = await resolve4(row.domain).catch(() => [] as string[]);
    const ok = !!row.service.server && ips.includes(row.service.server.serverIp);
    const updated = await this.prisma.client.serviceDomain.update({
      where: { id: row.id },
      data: { verifiedAt: ok ? new Date() : null },
    });
    return { ...this.domainDto(updated), dnsIps: ips };
  }

  async removeDomain(actor: Actor, id: string): Promise<void> {
    const row = await this.prisma.client.serviceDomain.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: { service: { select: { serviceName: true, environment: { select: { projectId: true } } } } },
    });
    if (!row) throw new NotFoundException(DEPLOY_MESSAGES.domain_not_found);
    await this.prisma.client.serviceDomain.delete({ where: { id: row.id } });
    await this.audit.record(actor, {
      action: 'deploy_settings.updated',
      entityType: 'service',
      entityId: row.serviceId,
      metadata: { service: row.service.serviceName, domainRemoved: row.domain },
      projectId: row.service.environment.projectId,
    });
  }

  private domainDto(d: { id: string; domain: string; verifiedAt: Date | null }): ServiceDomain {
    return { id: d.id, domain: d.domain, verifiedAt: d.verifiedAt?.toISOString() ?? null };
  }

  // ── the proxy (Traefik) on a server ─────────────────────────────────────

  async proxyStatus(orgId: string, serverId: string, jobId?: string) {
    const server = await this.prisma.client.server.findFirst({
      where: { id: serverId, organizationId: orgId },
      select: { proxyInstalledAt: true },
    });
    if (!server) throw new NotFoundException(DEPLOY_MESSAGES.server_not_found);
    let job: { state: string; failedReason: string | null } | null = null;
    if (jobId) {
      const j = await this.queue.getJob(jobId);
      // A job id from another org's server must not leak its state.
      if (j && j.name === DEPLOY_JOBS.proxy && (j.data as { serverId?: string }).serverId === serverId) {
        job = { state: await j.getState(), failedReason: j.failedReason ?? null };
      }
    }
    return { installedAt: server.proxyInstalledAt?.toISOString() ?? null, job };
  }

  async setupProxy(actor: Actor, serverId: string): Promise<{ jobId: string }> {
    const server = await this.prisma.client.server.findFirst({
      where: { id: serverId, organizationId: actor.organizationId },
    });
    if (!server) throw new NotFoundException(DEPLOY_MESSAGES.server_not_found);
    if (server.serverType !== 'DEPLOY') throw new BadRequestException(DEPLOY_MESSAGES.proxy_build_server);
    const job = await this.queue
      .add(
        DEPLOY_JOBS.proxy,
        { serverId, organizationId: actor.organizationId },
        { attempts: 1, removeOnFail: { age: 3600 }, removeOnComplete: { age: 3600 } },
      )
      .catch(() => {
        throw new ServiceUnavailableException(DEPLOY_MESSAGES.not_queued);
      });
    await this.audit.record(actor, {
      action: 'server.proxy_installed',
      entityType: 'server',
      entityId: serverId,
      metadata: { name: server.serverName },
    });
    return { jobId: job.id! };
  }

  // ── helpers ────────────────────────────────────────────────────────────

  /** The version serving now: the newest deploy that went live. */
  private async liveId(serviceId: string): Promise<string | null> {
    const r = await this.prisma.client.deployment.findFirst({
      where: { serviceId, deploymentStatus: 'SUCCESS' },
      orderBy: { finishedAt: 'desc' },
      select: { id: true },
    });
    return r?.id ?? null;
  }

  private async serviceOf(orgId: string, serviceId: string) {
    const s = await this.prisma.client.service.findFirst({
      where: { id: serviceId, organizationId: orgId },
      include: { server: true, environment: { select: { projectId: true } } },
    });
    if (!s) throw new NotFoundException(DEPLOY_MESSAGES.service_not_found);
    return s;
  }

  /** The checks the api can make before queueing (the worker re-checks on the server). */
  private async deployable(orgId: string, serviceId: string) {
    const s = await this.serviceOf(orgId, serviceId);
    if (s.type !== 'APPLICATION' && s.type !== 'WORKER') throw new BadRequestException(DEPLOY_MESSAGES.not_deployable);
    if (!s.githubRepoUrl && !s.image) throw new BadRequestException(DEPLOY_MESSAGES.no_source);
    if (!s.server) throw new BadRequestException(DEPLOY_MESSAGES.no_server);
    if (s.type === 'APPLICATION' && s.port == null) throw new BadRequestException(DEPLOY_MESSAGES.no_port);
    if (s.type === 'APPLICATION' && !s.server.proxyInstalledAt) throw new BadRequestException(DEPLOY_MESSAGES.no_proxy);
    return s;
  }

  private async queueDeploy(
    svc: Awaited<ReturnType<DeployService['deployable']>>,
    d: {
      triggeredById: string | null;
      triggeredByName: string | null;
      commitSha: string | null;
      message: string | null;
      branch?: string | null;
      rollbackOfId?: string;
      type?: 'MANUAL' | 'AUTOMATED';
    },
  ) {
    const dep = await this.prisma.client.$transaction(async (tx) => {
      const busy = await tx.deployment.findFirst({
        where: { serviceId: svc.id, deploymentStatus: { in: [...IN_PROGRESS] } },
        select: { id: true },
      });
      if (busy) throw new ConflictException(DEPLOY_MESSAGES.busy);
      return createDeployment(tx, {
        orgId: svc.organizationId,
        serviceId: svc.id,
        message: d.message,
        triggeredById: d.triggeredById,
        triggeredByName: d.triggeredByName,
        type: d.type,
        branch: d.branch ?? svc.branch,
        commitSha: d.commitSha,
        rollbackOfId: d.rollbackOfId,
      });
    });
    const job: DeployJob = { deploymentId: dep.id, serviceId: svc.id, organizationId: svc.organizationId };
    try {
      await this.queue.add(DEPLOY_JOBS.deploy, job, { attempts: 1 });
    } catch {
      await this.prisma.client.deployment.update({
        where: { id: dep.id },
        data: {
          deploymentStatus: 'FAILED',
          finishedAt: new Date(),
          history: { create: { status: 'FAILED', message: 'Could not queue the deploy' } },
        },
      });
      throw new ServiceUnavailableException(DEPLOY_MESSAGES.not_queued);
    }
    return dep;
  }

  private async one(orgId: string, id: string): Promise<Deployment> {
    const r = await this.prisma.client.deployment.findFirstOrThrow({
      where: { id, organizationId: orgId },
      include: { rollbackOf: { select: { number: true } } },
    });
    return this.toDto(r, await this.liveId(r.serviceId));
  }

  private toDto(r: DeploymentRow, liveId: string | null): Deployment {
    return {
      id: r.id,
      number: r.number,
      status: r.deploymentStatus,
      type: r.deploymentType,
      branch: r.branch,
      commitSha: r.commitSha,
      commitMessage: r.commitMessage,
      triggeredByName: r.triggeredByName,
      buildMethod: r.buildMethod,
      imageTag: r.imageTag,
      rollbackOfNumber: r.rollbackOf?.number ?? null,
      live: r.id === liveId,
      createdAt: r.createdAt.toISOString(),
      startedAt: r.startedAt?.toISOString() ?? null,
      finishedAt: r.finishedAt?.toISOString() ?? null,
    };
  }

  private async actorName(actor: Actor): Promise<string | null> {
    if (actor.userId) {
      const u = await this.prisma.client.user.findUnique({
        where: { id: actor.userId },
        select: { firstName: true, lastName: true },
      });
      return u ? `${u.firstName} ${u.lastName}`.trim() : null;
    }
    if (actor.apiTokenId) {
      const t = await this.prisma.client.apiToken.findUnique({
        where: { id: actor.apiTokenId },
        select: { apiName: true },
      });
      return t ? `token: ${t.apiName}` : null;
    }
    return null;
  }
}
