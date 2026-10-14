import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'db';
import type {
  ConnectionStep,
  ConnectionStepName,
  ConnectionTest,
  CreateServerInput,
  Server,
  UpdateServerInput,
} from 'shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { Actor } from '../../common/types/actor';
import {
  SERVER_MESSAGES,
  SSH_KEY_MESSAGES,
} from '../../common/constants/messages.config';
import { OrgKeyService } from '../warden-crypto/org-key.service';
import { decrypt } from 'warden-crypto';
import { SshError, withSsh } from 'ssh-client';
@Injectable()
export class ServerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgKey: OrgKeyService,
    private readonly audit: AuditService,
  ) {}

  //create a server
  async createServer(actor: Actor, input: CreateServerInput): Promise<Server> {
    const orgId = actor.organizationId;
    await this.assertKeyInOrg(orgId, input.serverSshKeyId);

    try {
      const row = await this.prisma.client.server.create({
        data: {
          serverName: input.serverName,
          serverIp: input.serverIp,
          serverPort: input.serverPort,
          serverSSHUsername: input.serverSSHUsername,
          serverSshKeyId: input.serverSshKeyId,
          serverType: input.serverType,
          provider: input.provider,
          serverLocation: input.serverLocation,
          organizationId: orgId,
        },
        include: SERVER_DETAIL,
      });
      await this.audit.record(actor, {
        action: 'server.created',
        entityType: 'server',
        entityId: row.id,
        metadata: { name: row.serverName, host: row.serverIp },
      });
      return toServer(row);
    } catch (e) {
      throw this.translateUniqueError(e);
    }
  }

  // list all server
  async listServers(orgId: string): Promise<Server[]> {
    const rows = await this.prisma.client.server.findMany({
      where: { organizationId: orgId },
      include: SERVER_DETAIL,
      orderBy: { serverName: 'asc' },
    });
    return rows.map(toServer);
  }

  //   get a server
  async getServer(orgId: string, id: string): Promise<Server> {
    return toServer(await this.findOrThrow(orgId, id));
  }

  //   update server
  async updateServer(
    orgId: string,
    id: string,
    input: UpdateServerInput,
  ): Promise<Server> {
    const current = await this.findOrThrow(orgId, id);
    if (input.serverSshKeyId) {
      await this.assertKeyInOrg(orgId, input.serverSshKeyId);
    }

    const connectionChanged =
      (input.serverIp !== undefined && input.serverIp !== current.serverIp) ||
      (input.serverPort !== undefined &&
        input.serverPort !== current.serverPort) ||
      (input.serverSSHUsername !== undefined &&
        input.serverSSHUsername !== current.serverSSHUsername) ||
      (input.serverSshKeyId !== undefined &&
        input.serverSshKeyId !== current.serverSshKeyId);

    try {
      const row = await this.prisma.client.server.update({
        where: { id: current.id },
        data: {
          // undefined = Prisma skips the column; null clears it.
          serverName: input.serverName,
          serverIp: input.serverIp,
          serverPort: input.serverPort,
          serverSSHUsername: input.serverSSHUsername,
          serverSshKeyId: input.serverSshKeyId,
          provider: input.provider,
          serverLocation: input.serverLocation,
          ...(connectionChanged && { status: 'OFFLINE', lastSeenAt: null }),
        },
        include: SERVER_DETAIL,
      });
      return toServer(row);
    } catch (e) {
      throw this.translateUniqueError(e);
    }
  }

  async deleteServer(actor: Actor, id: string): Promise<void> {
    const orgId = actor.organizationId;
    const row = await this.findOrThrow(orgId, id);
    const hasServices = (n: number) =>
      new ConflictException(
        SERVER_MESSAGES.has_services.replace('{count}', String(n)),
      );
    if (row._count.services > 0) throw hasServices(row._count.services);

    try {
      await this.prisma.client.server.delete({ where: { id: row.id } });
      await this.audit.record(actor, {
        action: 'server.deleted',
        entityType: 'server',
        entityId: row.id,
        metadata: { name: row.serverName, host: row.serverIp },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        const n = await this.prisma.client.service.count({
          where: { serverId: row.id, organizationId: orgId },
        });
        throw hasServices(n);
      }
      throw e;
    }
  }

  //   test connection

  async testConnection(orgId: string, id: string): Promise<ConnectionTest> {
    const row = await this.prisma.client.server.findFirst({
      where: { id, organizationId: orgId },
      include: {
        serverSshKey: { select: { id: true, privateKeyEncrypted: true } },
      },
    });
    if (!row) throw new NotFoundException(SERVER_MESSAGES.not_found);

    const dek = await this.orgKey.getDek(orgId);
    const privateKey = decrypt(row.serverSshKey.privateKeyEncrypted, {
      v1: dek,
    });

    let steps: ConnectionStep[];
    try {
      const result = await withSsh(
        {
          host: row.serverIp,
          port: row.serverPort,
          username: row.serverSSHUsername,
          privateKey,
        },
        async (run) => ({
          system: await run('uname -sr'),
          docker: await run("docker version --format '{{.Server.Version}}'"),
        }),
      );

      const dockerOk = result.docker.code === 0;
      steps = [
        { name: 'reach', ok: true },
        { name: 'login', ok: true, detail: `as ${row.serverSSHUsername}` },
        { name: 'system', ok: true, detail: result.system.stdout.trim() },
        {
          name: 'docker',
          ok: dockerOk,
          detail: dockerOk
            ? `Docker ${result.docker.stdout.trim()}`
            : 'not installed, or this user has no permission',
        },
      ];
    } catch (e) {
      const kind = e instanceof SshError ? e.kind : 'unknown';
      steps =
        kind === 'auth_failed'
          ? failedAt(
              'login',
              'key refused (check authorized_keys and username)',
            )
          : kind === 'timeout'
            ? failedAt('reach', 'timed out')
            : kind === 'unreachable'
              ? failedAt('reach', 'unreachable (check IP, port, firewall)')
              : failedAt('reach', 'connection failed');
    }

    const ok = steps.find((s) => s.name === 'login')?.ok ?? false;
    const now = new Date();
    await this.prisma.client.server.update({
      where: { id: row.id },
      data: ok
        ? { status: 'CONNECTED', lastSeenAt: now }
        : { status: 'OFFLINE' },
    });
    if (ok) {
      await this.prisma.client.sshKey.update({
        where: { id: row.serverSshKey.id },
        data: { lastUsedAt: now },
      });
    }

    return { ok, steps };
  }

  //  helpers

  private async findOrThrow(orgId: string, id: string) {
    const row = await this.prisma.client.server.findFirst({
      where: { id, organizationId: orgId },
      include: SERVER_DETAIL,
    });
    if (!row) throw new NotFoundException(SERVER_MESSAGES.not_found);
    return row;
  }

  private async assertKeyInOrg(orgId: string, keyId: string): Promise<void> {
    const key = await this.prisma.client.sshKey.findFirst({
      where: { id: keyId, organizationId: orgId },
      select: { id: true },
    });
    if (!key) throw new NotFoundException(SSH_KEY_MESSAGES.not_found);
  }

  private translateUniqueError(e: unknown): unknown {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      return new ConflictException(SERVER_MESSAGES.duplicate_address);
    }
    return e;
  }
}

const SERVER_DETAIL = {
  serverSshKey: { select: { id: true, sshKeyName: true, fingerprint: true } },
  _count: { select: { services: true } },
} satisfies Prisma.ServerInclude;

type ServerRow = Prisma.ServerGetPayload<{ include: typeof SERVER_DETAIL }>;

function toServer(row: ServerRow): Server {
  return {
    id: row.id,
    serverName: row.serverName,
    serverIp: row.serverIp,
    serverPort: row.serverPort,
    serverSSHUsername: row.serverSSHUsername,
    serverType: row.serverType,
    status: row.status,
    provider: row.provider,
    serverLocation: row.serverLocation,
    sshKey: {
      id: row.serverSshKey.id,
      sshKeyName: row.serverSshKey.sshKeyName,
      fingerprint: row.serverSshKey.fingerprint,
    },
    serviceCount: row._count.services,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

const STEP_ORDER: ConnectionStepName[] = ['reach', 'login', 'system', 'docker'];
function failedAt(at: ConnectionStepName, detail: string): ConnectionStep[] {
  const i = STEP_ORDER.indexOf(at);
  return STEP_ORDER.map((name, j) =>
    j < i
      ? { name, ok: true }
      : j === i
        ? { name, ok: false, detail }
        : { name, ok: false, detail: 'skipped' },
  );
}
