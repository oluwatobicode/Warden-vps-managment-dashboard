import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  Environment,
  UpdateEnvironmentInput,
  type CreateEnvironmentInput,
} from 'shared-types';
import {
  ENVIRONMENT_MESSAGES,
  PROJECT_MESSAGES,
} from '../../common/constants/messages.config';
import { Prisma } from 'db';

@Injectable()
export class EnvironmentService {
  constructor(private readonly prisma: PrismaService) {}

  async createEnvironment(
    orgId: string,
    input: CreateEnvironmentInput,
  ): Promise<Environment> {
    const project = await this.prisma.client.project.findFirst({
      where: { id: input.projectId, organizationId: orgId },
    });

    if (!project) {
      throw new NotFoundException(PROJECT_MESSAGES.not_found);
    }

    try {
      const created = await this.prisma.client.environment.create({
        data: {
          environmentName: input.environmentName,
          branch: input.branch,
          projectId: input.projectId,
          organizationId: orgId,
        },
        include: WITH_SERVICE_COUNT,
      });

      return toEnvironment(created);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(ENVIRONMENT_MESSAGES.name_taken);
      }
      throw e;
    }
  }

  async listEnvironments(
    orgId: string,
    projectId: string,
  ): Promise<Environment[]> {
    const rows = await this.prisma.client.environment.findMany({
      where: { organizationId: orgId, projectId },
      include: WITH_SERVICE_COUNT,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toEnvironment);
  }

  async getEnvironment(orgId: string, id: string) {
    const row = await this.prisma.client.environment.findFirst({
      where: { id, organizationId: orgId },
      include: WITH_SERVICE_COUNT,
    });

    if (!row) throw new NotFoundException(ENVIRONMENT_MESSAGES.not_found);
    return toEnvironment(row);
  }

  async updateEnvironment(
    orgId: string,
    id: string,
    input: UpdateEnvironmentInput,
  ): Promise<Environment> {
    await this.assertExists(orgId, id);

    try {
      const updated = await this.prisma.client.environment.update({
        where: { id },
        data: input,
        include: WITH_SERVICE_COUNT,
      });
      return toEnvironment(updated);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(ENVIRONMENT_MESSAGES.name_taken);
      }
      throw e;
    }
  }

  async deleteEnvironment(orgId: string, id: string): Promise<void> {
    const env = await this.prisma.client.environment.findFirst({
      where: { id, organizationId: orgId },
      select: { projectId: true },
    });
    if (!env) throw new NotFoundException(ENVIRONMENT_MESSAGES.not_found);

    const siblings = await this.prisma.client.environment.count({
      where: { projectId: env.projectId, organizationId: orgId },
    });
    if (siblings <= 1) {
      throw new ConflictException(ENVIRONMENT_MESSAGES.last_environment);
    }

    try {
      await this.prisma.client.environment.delete({ where: { id } });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new ConflictException(ENVIRONMENT_MESSAGES.has_assigned_services);
      }
      throw e;
    }
  }

  private async assertExists(orgId: string, id: string) {
    const row = await this.prisma.client.environment.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });

    if (!row) throw new NotFoundException(ENVIRONMENT_MESSAGES.not_found);
  }
}

const WITH_SERVICE_COUNT = {
  _count: { select: { services: true } },
} satisfies Prisma.EnvironmentInclude;

type EnvironmentRow = Prisma.EnvironmentGetPayload<{
  include: typeof WITH_SERVICE_COUNT;
}>;

function toEnvironment(row: EnvironmentRow): Environment {
  return {
    id: row.id,
    environmentName: row.environmentName,
    branch: row.branch,
    serviceCount: row._count.services,
    createdAt: row.createdAt.toISOString(),
  };
}
