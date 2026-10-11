import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'db';
import type {
  CreateServerInput,
  Server,
  UpdateServerInput,
} from 'shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SERVER_MESSAGES,
  SSH_KEY_MESSAGES,
} from '../../common/constants/messages.config';

/**
 * Servers as DATA: an address-book entry ("here's a machine, here's how to get
 * in"). Saving one connects to nothing. Test connection (3b) is where Warden
 * first picks up the phone.
 */
@Injectable()
export class ServerService {
  constructor(private readonly prisma: PrismaService) {}

  /** POST /servers */
  async createServer(orgId: string, input: CreateServerInput): Promise<Server> {
    await this.assertKeyInOrg(orgId, input.serverSshKeyId);

    try {
      // One write → no transaction needed (transactions group SEVERAL writes).
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
          organizationId: orgId, // from the session, never the body
        },
        include: SERVER_DETAIL,
      });
      return toServer(row);
    } catch (e) {
      throw this.translateUniqueError(e);
    }
  }

  /** GET /servers */
  async listServers(orgId: string): Promise<Server[]> {
    const rows = await this.prisma.client.server.findMany({
      where: { organizationId: orgId },
      include: SERVER_DETAIL,
      orderBy: { serverName: 'asc' },
    });
    return rows.map(toServer);
  }

  /** GET /servers/:id */
  async getServer(orgId: string, id: string): Promise<Server> {
    return toServer(await this.findOrThrow(orgId, id));
  }

  /**
   * PATCH /servers/:id. If anything that affects HOW we connect changes
   * (address, port, user, key), the old "CONNECTED" badge was earned with the
   * old settings and is now a lie — reset to OFFLINE until re-tested.
   */
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

  /**
   * DELETE /servers/:id. Refused while services are assigned — those are live
   * containers, and forgetting the server would orphan them. Checked first so
   * the message can say how many; P2003 (Restrict) is the race backstop.
   * Metrics/logs/containers cascade away with the server.
   */
  async deleteServer(orgId: string, id: string): Promise<void> {
    const row = await this.findOrThrow(orgId, id);
    const hasServices = (n: number) =>
      new ConflictException(
        SERVER_MESSAGES.has_services.replace('{count}', String(n)),
      );
    if (row._count.services > 0) throw hasServices(row._count.services);

    try {
      await this.prisma.client.server.delete({ where: { id: row.id } });
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

  // ── helpers ──────────────────────────────────────────────────────────────

  private async findOrThrow(orgId: string, id: string) {
    const row = await this.prisma.client.server.findFirst({
      where: { id, organizationId: orgId }, // never findUnique by id alone
      include: SERVER_DETAIL,
    });
    if (!row) throw new NotFoundException(SERVER_MESSAGES.not_found);
    return row;
  }

  /** The key must be OURS. The composite FK would refuse a foreign one anyway, but as a 500. */
  private async assertKeyInOrg(orgId: string, keyId: string): Promise<void> {
    const key = await this.prisma.client.sshKey.findFirst({
      where: { id: keyId, organizationId: orgId },
      select: { id: true },
    });
    // NotFoundException (404), not `new Error` — a plain Error becomes a 500.
    if (!key) throw new NotFoundException(SSH_KEY_MESSAGES.not_found);
  }

  /** @@unique([organizationId, serverIp, serverPort]) → a friendly 409. */
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
