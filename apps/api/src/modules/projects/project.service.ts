import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'db';
import type {
  CreateProjectInput,
  Project,
  ProjectDetail,
  UpdateProjectInput,
} from 'shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { pickServer } from '../environments/pick-server';
import { AuditService } from '../audit/audit.service';
import type { Actor } from '../../common/types/actor';
import { slugify } from '../../common/utils/slug.util';
import { PROJECT_MESSAGES } from '../../common/constants/messages.config';
import { rollupStatus } from './status-rollup';

@Injectable()
export class ProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** POST /projects */
  async createProject(
    actor: Actor,
    input: CreateProjectInput,
  ): Promise<ProjectDetail> {
    const orgId = actor.organizationId;
    const slug = slugify(input.projectName);

    const taken = await this.prisma.client.project.findFirst({
      where: { organizationId: orgId, slug },
      select: { id: true },
    });
    if (taken) throw new ConflictException(PROJECT_MESSAGES.slug_taken);
    if (input.defaultServerId) {
      await pickServer(this.prisma, orgId, '', input.defaultServerId);
    }

    let project;
    try {
      project = await this.prisma.client.$transaction(async (tx) => {
        const created = await tx.project.create({
          data: {
            projectName: input.projectName,
            projectDescription: input.projectDescription,
            slug,
            organizationId: orgId,
          },
        });

        await tx.environment.createMany({
          data: input.environments.map((environmentName) => ({
            environmentName,
            defaultServerId: input.defaultServerId ?? null,
            projectId: created.id,
            organizationId: orgId,
          })),
        });

        return created;
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(PROJECT_MESSAGES.slug_taken);
      }
      throw e;
    }

    await this.audit.record(actor, {
      action: 'project.created',
      entityType: 'project',
      entityId: project.id,
      metadata: { name: project.projectName },
      projectId: project.id,
    });

    return this.getProject(orgId, project.id);
  }

  async listProjects(orgId: string): Promise<Project[]> {
    const rows = await this.prisma.client.project.findMany({
      where: { organizationId: orgId },
      include: PROJECT_COUNTS,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toProject);
  }

  async getProject(orgId: string, id: string): Promise<ProjectDetail> {
    const row = await this.prisma.client.project.findFirst({
      where: { id, organizationId: orgId },
      include: PROJECT_DETAIL,
    });
    if (!row) throw new NotFoundException(PROJECT_MESSAGES.not_found);
    return toProjectDetail(row);
  }

  async updateProject(
    orgId: string,
    id: string,
    input: UpdateProjectInput,
  ): Promise<ProjectDetail> {
    await this.assertExists(orgId, id);
    await this.prisma.client.project.update({
      where: { id },
      data: {
        projectName: input.projectName,
        projectDescription: input.projectDescription,
      },
    });
    return this.getProject(orgId, id);
  }

  async deleteProject(actor: Actor, id: string): Promise<void> {
    const orgId = actor.organizationId;
    // Read the name BEFORE the row is gone, for the audit line.
    const project = await this.prisma.client.project.findFirst({
      where: { id, organizationId: orgId },
      select: { projectName: true },
    });
    if (!project) throw new NotFoundException(PROJECT_MESSAGES.not_found);
    try {
      await this.prisma.client.project.delete({ where: { id } });
      await this.audit.record(actor, {
        action: 'project.deleted',
        entityType: 'project',
        entityId: id,
        metadata: { name: project.projectName },
        projectId: id,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new ConflictException(PROJECT_MESSAGES.has_assigned_services);
      }
      throw e;
    }
  }

  private async assertExists(orgId: string, id: string): Promise<void> {
    const found = await this.prisma.client.project.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException(PROJECT_MESSAGES.not_found);
  }
}

// Each service's status (not just a count): the count is the list's length,
// and the statuses feed the worst-status-wins rollup.
const SERVICE_STATUSES = { services: { select: { status: true } } } as const;

const PROJECT_COUNTS = {
  _count: { select: { environments: true } },
  environments: { select: SERVICE_STATUSES },
} satisfies Prisma.ProjectInclude;

const PROJECT_DETAIL = {
  _count: { select: { environments: true } },
  environments: {
    include: SERVICE_STATUSES,
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.ProjectInclude;

type ProjectWithCounts = Prisma.ProjectGetPayload<{
  include: typeof PROJECT_COUNTS;
}>;
type ProjectWithDetail = Prisma.ProjectGetPayload<{
  include: typeof PROJECT_DETAIL;
}>;

function toProject(row: ProjectWithCounts | ProjectWithDetail): Project {
  const services = row.environments.flatMap((e) => e.services);
  return {
    id: row.id,
    projectName: row.projectName,
    slug: row.slug,
    projectDescription: row.projectDescription,
    environmentCount: row._count.environments,
    serviceCount: services.length,
    status: rollupStatus(services.map((s) => s.status)),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toProjectDetail(row: ProjectWithDetail): ProjectDetail {
  return {
    ...toProject(row),
    environments: row.environments.map((e) => ({
      id: e.id,
      environmentName: e.environmentName,
      branch: e.branch,
      defaultServerId: e.defaultServerId,
      serviceCount: e.services.length,
      status: rollupStatus(e.services.map((s) => s.status)),
      createdAt: e.createdAt.toISOString(),
    })),
  };
}
