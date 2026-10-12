import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'db';
import {
  serviceTypeIssues,
  type AssignServerInput,
  type CreateServiceInput,
  type Service,
  type UpdateServiceInput,
} from 'shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ENVIRONMENT_MESSAGES,
  SERVER_MESSAGES,
  SERVICE_MESSAGES,
} from '../../common/constants/messages.config';

@Injectable()
export class ServiceService {
  constructor(private readonly prisma: PrismaService) {}

  async createService(
    orgId: string,
    input: CreateServiceInput,
  ): Promise<Service> {
    const env = await this.prisma.client.environment.findFirst({
      where: { id: input.environmentId, organizationId: orgId },
      select: { id: true },
    });
    if (!env) throw new NotFoundException(ENVIRONMENT_MESSAGES.not_found);

    try {
      const row = await this.prisma.client.service.create({
        data: {
          serviceName: input.serviceName,
          type: input.type,
          githubRepoUrl: input.githubRepoUrl,
          branch: input.branch,
          port: input.port,
          image: input.image,
          environmentId: input.environmentId,
          organizationId: orgId,
        },
      });
      return toService(row);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(SERVICE_MESSAGES.name_taken);
      }
      throw e;
    }
  }

  async listServices(orgId: string, environmentId: string): Promise<Service[]> {
    const rows = await this.prisma.client.service.findMany({
      where: { environmentId, organizationId: orgId },
      orderBy: { serviceName: 'asc' },
    });
    return rows.map(toService);
  }

  // get a service
  async getService(orgId: string, id: string): Promise<Service> {
    const row = await this.prisma.client.service.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!row) throw new NotFoundException(SERVICE_MESSAGES.not_found);
    return toService(row);
  }

  // update service
  async updateService(
    orgId: string,
    id: string,
    input: UpdateServiceInput,
  ): Promise<Service> {
    const current = await this.prisma.client.service.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!current) throw new NotFoundException(SERVICE_MESSAGES.not_found);

    const next = {
      type: current.type,
      port: input.port === undefined ? current.port : input.port,
      githubRepoUrl:
        input.githubRepoUrl === undefined
          ? current.githubRepoUrl
          : input.githubRepoUrl,
      image: input.image === undefined ? current.image : input.image,
    };
    const issues = serviceTypeIssues(next);
    if (issues.length) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: Object.fromEntries(issues.map((i) => [i.path[0], [i.message]])),
      });
    }

    try {
      const row = await this.prisma.client.service.update({
        where: { id: current.id },
        data: {
          serviceName: input.serviceName,
          githubRepoUrl: input.githubRepoUrl,
          branch: input.branch,
          port: input.port,
          image: input.image,
        },
      });
      return toService(row);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(SERVICE_MESSAGES.name_taken);
      }
      throw e;
    }
  }

  // assign a service to a server
  async assignServer(
    orgId: string,
    id: string,
    input: AssignServerInput,
  ): Promise<Service> {
    const current = await this.prisma.client.service.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!current) throw new NotFoundException(SERVICE_MESSAGES.not_found);

    if (input.serverId === current.serverId) return toService(current);

    const mayBeRunning =
      current.status !== 'NOT_DEPLOYED' && current.status !== 'FAILED';
    if (current.serverId && mayBeRunning) {
      throw new ConflictException(SERVICE_MESSAGES.service_running);
    }

    if (input.serverId) {
      const server = await this.prisma.client.server.findFirst({
        where: { id: input.serverId, organizationId: orgId },
        select: { serverType: true },
      });
      if (!server) throw new NotFoundException(SERVER_MESSAGES.not_found);
      if (server.serverType !== 'DEPLOY') {
        throw new BadRequestException(SERVICE_MESSAGES.server_not_deploy);
      }
    }

    try {
      const row = await this.prisma.client.service.update({
        where: { id: current.id },
        data: { serverId: input.serverId },
      });
      return toService(row);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new ConflictException(SERVICE_MESSAGES.server_wrong_org);
      }
      throw e;
    }
  }

  // delete service
  async deleteService(orgId: string, id: string): Promise<void> {
    const row = await this.prisma.client.service.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true, serverId: true },
    });
    if (!row) throw new NotFoundException(SERVICE_MESSAGES.not_found);
    if (row.serverId) throw new ConflictException(SERVICE_MESSAGES.has_server);

    await this.prisma.client.service.delete({ where: { id: row.id } });
  }
}

function toService(row: Prisma.ServiceGetPayload<object>): Service {
  return {
    id: row.id,
    serviceName: row.serviceName,
    type: row.type,
    status: row.status,
    githubRepoUrl: row.githubRepoUrl,
    branch: row.branch,
    port: row.port,
    image: row.image,
    environmentId: row.environmentId,
    serverId: row.serverId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
