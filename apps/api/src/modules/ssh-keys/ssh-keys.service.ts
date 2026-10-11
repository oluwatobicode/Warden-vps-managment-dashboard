import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'db';
import type { CreateSshKeyInput, SshKey } from 'shared-types';
import { fingerprint, generateKeyPair, parsePrivateKey } from 'ssh-client';
import { encrypt } from 'warden-crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { OrgKeyService } from '../warden-crypto/org-key.service';
import { SSH_KEY_MESSAGES } from '../../common/constants/messages.config';

@Injectable()
export class SshKeyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgKeys: OrgKeyService,
  ) {}

  async createSshKey(orgId: string, input: CreateSshKeyInput): Promise<SshKey> {
    let publicKey: string;
    let privateKey: string;
    if (input.mode === 'generate') {
      ({ publicKey, privateKey } = generateKeyPair(
        `warden-${input.sshKeyName}`,
      ));
    } else {
      try {
        publicKey = parsePrivateKey(input.privateKey).publicKey;
      } catch {
        throw new BadRequestException(SSH_KEY_MESSAGES.invalid_key);
      }
      privateKey = input.privateKey;
    }

    const fp = fingerprint(publicKey);

    const dek = await this.orgKeys.getDek(orgId);
    const privateKeyEncrypted = encrypt(privateKey, dek, 'v1');

    try {
      const row = await this.prisma.client.sshKey.create({
        data: {
          sshKeyName: input.sshKeyName,
          publicKey,
          fingerprint: fp,
          privateKeyEncrypted,
          organizationId: orgId,
        },
        include: WITH_SERVER_COUNT,
      });

      return toSshKey(row);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(SSH_KEY_MESSAGES.name_taken);
      }
      throw e;
    }
  }

  async listSshKeys(orgId: string): Promise<SshKey[]> {
    const rows = await this.prisma.client.sshKey.findMany({
      where: { organizationId: orgId },
      include: WITH_SERVER_COUNT,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toSshKey);
  }

  async deleteSshKey(orgId: string, id: string): Promise<void> {
    const row = await this.prisma.client.sshKey.findFirst({
      where: { id, organizationId: orgId },
      include: WITH_SERVER_COUNT,
    });
    if (!row) throw new NotFoundException(SSH_KEY_MESSAGES.not_found);

    const inUse = (n: number) =>
      new ConflictException(
        SSH_KEY_MESSAGES.in_use.replace('{count}', String(n)),
      );
    if (row._count.servers > 0) throw inUse(row._count.servers);

    try {
      await this.prisma.client.sshKey.delete({ where: { id: row.id } });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        const servers = await this.prisma.client.server.count({
          where: { serverSshKeyId: row.id, organizationId: orgId },
        });
        throw inUse(servers);
      }
      throw e;
    }
  }
}

const WITH_SERVER_COUNT = {
  _count: { select: { servers: true } },
} satisfies Prisma.SshKeyInclude;

type SshKeyRow = Prisma.SshKeyGetPayload<{ include: typeof WITH_SERVER_COUNT }>;

function toSshKey(row: SshKeyRow): SshKey {
  return {
    id: row.id,
    sshKeyName: row.sshKeyName,
    publicKey: row.publicKey,
    fingerprint: row.fingerprint,
    serverCount: row._count.servers,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  };
}
