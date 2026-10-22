import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { pickServer } from './pick-server';
import { AuditService } from '../audit/audit.service';
import type { Actor } from '../../common/types/actor';
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
import { rollupStatus } from '../projects/status-rollup';

@Injectable()
export class EnvironmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createEnvironment(
    actor: Actor,
    input: CreateEnvironmentInput,
  ): Promise<Environment> {
    const orgId = actor.organizationId;
    const project = await this.prisma.client.project.findFirst({
      where: { id: input.projectId, organizationId: orgId },
    });

    if (!project) {
      throw new NotFoundException(PROJECT_MESSAGES.not_found);
    }
    if (input.defaultServerId) {
      await pickServer(this.prisma, orgId, '', input.defaultServerId);
    }

    try {
      const created = await this.prisma.client.environment.create({
        data: {
          environmentName: input.environmentName,
          branch: input.branch,
          defaultServerId: input.defaultServerId ?? null,
          projectId: input.projectId,
          organizationId: orgId,
        },
        include: WITH_SERVICE_STATUSES,
      });

      await this.audit.record(actor, {
        action: 'environment.created',
        entityType: 'environment',
        entityId: created.id,
        metadata: { name: created.environmentName, projectId: created.projectId },
        projectId: created.projectId,
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
      include: WITH_SERVICE_STATUSES,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toEnvironment);
  }

  async getEnvironment(orgId: string, id: string) {
    const row = await this.prisma.client.environment.findFirst({
      where: { id, organizationId: orgId },
      include: WITH_SERVICE_STATUSES,
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
    if (input.defaultServerId) {
      await pickServer(this.prisma, orgId, id, input.defaultServerId);
    }

    try {
      const updated = await this.prisma.client.environment.update({
        where: { id },
        data: input,
        include: WITH_SERVICE_STATUSES,
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

  async deleteEnvironment(actor: Actor, id: string): Promise<void> {
    const orgId = actor.organizationId;
    const env = await this.prisma.client.environment.findFirst({
      where: { id, organizationId: orgId },
      select: { projectId: true, environmentName: true },
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
      await this.audit.record(actor, {
        action: 'environment.deleted',
        entityType: 'environment',
        entityId: id,
        metadata: { name: env.environmentName, projectId: env.projectId },
        projectId: env.projectId,
      });
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

// Statuses, not just a count: the count is the list's length, and the
// statuses feed the worst-status-wins rollup.
const WITH_SERVICE_STATUSES = {
  services: { select: { status: true } },
} satisfies Prisma.EnvironmentInclude;

type EnvironmentRow = Prisma.EnvironmentGetPayload<{
  include: typeof WITH_SERVICE_STATUSES;
}>;

function toEnvironment(row: EnvironmentRow): Environment {
  return {
    id: row.id,
    environmentName: row.environmentName,
    branch: row.branch,
    defaultServerId: row.defaultServerId,
    serviceCount: row.services.length,
    status: rollupStatus(row.services.map((s) => s.status)),
    createdAt: row.createdAt.toISOString(),
  };
}
