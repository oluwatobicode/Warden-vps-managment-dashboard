import { BadGatewayException, BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { q } from 'docker-client';
import { shortId } from 'shared-types';
import { withSsh, type Run } from 'ssh-client';
import { decrypt } from 'warden-crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { OrgKeyService } from '../warden-crypto/org-key.service';
import { AuditService } from '../audit/audit.service';
import { DEPLOY_MESSAGES } from '../../common/constants/messages.config';
import type { Actor } from '../../common/types/actor';

const IN_PROGRESS = ['QUEUED', 'BUILDING', 'DEPLOYING', 'HEALTH_CHECK'] as const;

interface ServerRow {
  id: string;
  serverName: string;
  serverIp: string;
  serverPort: number;
  serverSSHUsername: string;
  serverSshKey: { privateKeyEncrypted: string };
}

/** What couldn't be removed because its server wasn't reachable ("Delete anyway"). */
export interface Leftover {
  serverName: string;
  serviceName: string;
  /** Paste on the server to clean up by hand. */
  command: string;
}

/**
 * Taking apps off their servers: stop, start, and remove (containers, which
 * takes their Traefik route with them, plus the kept images). Quick SSH
 * commands, so done right in the request rather than as worker jobs. Used by
 * service, environment and project deletes, so none of them can leave an
 * app running on a server with no service in Warden.
 */
@Injectable()
export class AppControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgKeys: OrgKeyService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Remove these apps' containers and images from their servers. A server
   * that can't be reached stops everything (nothing is deleted) unless
   * `force`, in which case it's skipped and listed as a leftover.
   */
  async removeFromServers(orgId: string, serviceIds: string[], force: boolean): Promise<Leftover[]> {
    if (!serviceIds.length) return [];
    const services = await this.prisma.client.service.findMany({
      where: { id: { in: serviceIds }, organizationId: orgId, serverId: { not: null }, type: { in: ['APPLICATION', 'WORKER'] } },
      include: { server: { include: { serverSshKey: { select: { privateKeyEncrypted: true } } } } },
    });
    const busy = await this.prisma.client.deployment.findFirst({
      where: { serviceId: { in: services.map((s) => s.id) }, deploymentStatus: { in: [...IN_PROGRESS] } },
      select: { service: { select: { serviceName: true } } },
    });
    if (busy) throw new ConflictException(DEPLOY_MESSAGES.busy_remove.replace('{name}', busy.service.serviceName));

    const byServer = new Map<string, { server: ServerRow; services: typeof services }>();
    for (const s of services) {
      const entry = byServer.get(s.server!.id) ?? { server: s.server!, services: [] };
      entry.services.push(s);
      byServer.set(s.server!.id, entry);
    }
    const leftovers: Leftover[] = [];
    for (const { server, services: list } of byServer.values()) {
      try {
        await this.ssh(orgId, server, async (run) => {
          for (const s of list) await removeApp(run, s.id);
        });
      } catch {
        if (!force) throw new BadGatewayException(DEPLOY_MESSAGES.remove_unreachable.replace('{server}', server.serverName));
        for (const s of list) leftovers.push({ serverName: server.serverName, serviceName: s.serviceName, command: cleanupCommand(s.id) });
      }
    }
    return leftovers;
  }

  /** Stop: the live version stops serving; everything is kept for Start. */
  async stop(actor: Actor, serviceId: string): Promise<void> {
    const { svc, container } = await this.live(actor.organizationId, serviceId);
    await this.ssh(actor.organizationId, svc.server!, async (run) => {
      const r = await run(`docker stop -t 10 ${q(container)}`);
      if (r.code !== 0 && !/No such container/i.test(r.stderr)) throw new Error(r.stderr);
    }).catch((e) => this.unreachable(e, svc.server!.serverName));
    await this.prisma.client.service.update({ where: { id: serviceId }, data: { status: 'STOPPED' } });
    await this.record(actor, 'service.stopped', svc);
  }

  /** Start: the version that was live runs again (the same image, the same variables). */
  async start(actor: Actor, serviceId: string): Promise<void> {
    const { svc, container } = await this.live(actor.organizationId, serviceId);
    await this.ssh(actor.organizationId, svc.server!, async (run) => {
      const r = await run(`docker start ${q(container)}`);
      if (r.code !== 0) {
        throw new ConflictException(/No such container/i.test(r.stderr) ? DEPLOY_MESSAGES.start_missing : `${DEPLOY_MESSAGES.start_failed}: ${r.stderr.trim().split('\n')[0]}`);
      }
      // Up and still up a few seconds later (an app that crashes at once shows here).
      await new Promise((res) => setTimeout(res, 4000));
      const st = await run(`docker inspect --format '{{.State.Running}}' ${q(container)}`);
      if (st.stdout.trim() !== 'true') throw new ConflictException(DEPLOY_MESSAGES.start_crashed);
    }).catch((e) => this.unreachable(e, svc.server!.serverName));
    await this.prisma.client.service.update({ where: { id: serviceId }, data: { status: 'HEALTHY' } });
    await this.record(actor, 'service.started', svc);
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  /** The service and the container of its live version. Not while a deploy runs. */
  private async live(orgId: string, serviceId: string) {
    const svc = await this.prisma.client.service.findFirst({
      where: { id: serviceId, organizationId: orgId },
      include: {
        server: { include: { serverSshKey: { select: { privateKeyEncrypted: true } } } },
        environment: { select: { projectId: true } },
      },
    });
    if (!svc) throw new NotFoundException(DEPLOY_MESSAGES.service_not_found);
    if (svc.type !== 'APPLICATION' && svc.type !== 'WORKER') throw new BadRequestException(DEPLOY_MESSAGES.not_deployable);
    if (!svc.server) throw new BadRequestException(DEPLOY_MESSAGES.no_server);
    const busy = await this.prisma.client.deployment.findFirst({
      where: { serviceId, deploymentStatus: { in: [...IN_PROGRESS] } },
      select: { id: true },
    });
    if (busy) throw new ConflictException(DEPLOY_MESSAGES.busy);
    const live = await this.prisma.client.deployment.findFirst({
      where: { serviceId, deploymentStatus: 'SUCCESS' },
      orderBy: { finishedAt: 'desc' },
      select: { containerName: true },
    });
    if (!live?.containerName) throw new BadRequestException(DEPLOY_MESSAGES.nothing_live);
    return { svc, container: live.containerName };
  }

  private async ssh<T>(orgId: string, server: ServerRow, fn: (run: Run) => Promise<T>): Promise<T> {
    const privateKey = decrypt(server.serverSshKey.privateKeyEncrypted, { v1: await this.orgKeys.getDek(orgId) });
    return withSsh({ host: server.serverIp, port: server.serverPort, username: server.serverSSHUsername, privateKey }, (run) => fn(run));
  }

  /** Our own clear errors go through; a connection problem becomes "couldn't reach". */
  private unreachable(e: unknown, serverName: string): never {
    if (e instanceof ConflictException || e instanceof BadRequestException) throw e;
    throw new BadGatewayException(DEPLOY_MESSAGES.remove_unreachable.replace('{server}', serverName));
  }

  private async record(
    actor: Actor,
    action: 'service.stopped' | 'service.started',
    svc: { id: string; serviceName: string; environment: { projectId: string } },
  ) {
    await this.audit.record(actor, { action, entityType: 'service', entityId: svc.id, metadata: { service: svc.serviceName }, projectId: svc.environment.projectId });
  }
}

/** Every container of the app (all versions, half-finished ones too) and its kept images. */
async function removeApp(run: Run, serviceId: string): Promise<void> {
  const r = await run(cleanupCommand(serviceId));
  if (r.code !== 0) throw new Error(r.stderr || 'docker failed');
}

function cleanupCommand(serviceId: string): string {
  const label = q(`label=warden.service=${serviceId}`);
  const repo = q(`warden/${shortId(serviceId)}`);
  return [
    `ids=$(docker ps -aq --filter ${label}); [ -z "$ids" ] || docker rm -f $ids >/dev/null`,
    `imgs=$(docker image ls ${repo} -q | sort -u); [ -z "$imgs" ] || docker rmi -f $imgs >/dev/null 2>&1; true`,
  ].join('; ');
}
