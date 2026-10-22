import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import {
  ENVIRONMENT_MESSAGES,
  SERVER_MESSAGES,
} from '../../common/constants/messages.config';

/**
 * Which server a new service or database goes on: the one asked for (it must
 * be a DEPLOY server of this org), else its environment's default. Null when
 * neither is set (a service can be assigned later; a database can't).
 */
export async function pickServer(
  prisma: PrismaService,
  orgId: string,
  environmentId: string,
  serverId?: string | null,
): Promise<string | null> {
  if (serverId) {
    const server = await prisma.client.server.findFirst({
      where: { id: serverId, organizationId: orgId },
      select: { serverType: true },
    });
    if (!server) throw new NotFoundException(SERVER_MESSAGES.not_found);
    if (server.serverType !== 'DEPLOY') {
      throw new BadRequestException(SERVER_MESSAGES.deploy_only);
    }
    return serverId;
  }
  const env = await prisma.client.environment.findFirst({
    where: { id: environmentId, organizationId: orgId },
    select: { defaultServerId: true },
  });
  if (!env) throw new NotFoundException(ENVIRONMENT_MESSAGES.not_found);
  return env.defaultServerId;
}
