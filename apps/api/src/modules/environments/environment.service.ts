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
        // Unique (projectId, environmentName) fired: a 409, not a 404 — the row WAS found.
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
      where: { organizationId: orgId, projectId }, // projectId = what was asked; orgId = tenancy
      include: WITH_SERVICE_COUNT,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toEnvironment); // findMany never returns null, so no check needed
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
      // Prisma skips undefined fields, so a body with only `branch` leaves the name alone.
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
        // Renamed into a sibling's name.
        throw new ConflictException(ENVIRONMENT_MESSAGES.name_taken);
      }
      throw e;
    }
  }

  /**
   * Cascade removes the environment's services — unless one is still assigned
   * to a server (Restrict → P2003). And a project must keep at least one
   * environment: zero environments can hold no services, which is a broken
   * project. Same shape as the last-admin rule in team.
   */
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
