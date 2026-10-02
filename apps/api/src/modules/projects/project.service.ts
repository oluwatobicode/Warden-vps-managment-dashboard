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
import { slugify } from '../../common/utils/slug.util';
import { PROJECT_MESSAGES } from '../../common/constants/messages.config';

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  /** POST /projects */
  async createProject(
    orgId: string,
    input: CreateProjectInput,
  ): Promise<ProjectDetail> {
    const slug = slugify(input.projectName);

    const taken = await this.prisma.client.project.findFirst({
      where: { organizationId: orgId, slug },
      select: { id: true },
    });
    if (taken) throw new ConflictException(PROJECT_MESSAGES.slug_taken);

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

  async deleteProject(orgId: string, id: string): Promise<void> {
    await this.assertExists(orgId, id);
    try {
      await this.prisma.client.project.delete({ where: { id } });
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

const PROJECT_COUNTS = {
  _count: { select: { environments: true } },
  environments: { select: { _count: { select: { services: true } } } },
} satisfies Prisma.ProjectInclude;

const PROJECT_DETAIL = {
  _count: { select: { environments: true } },
  environments: {
    include: { _count: { select: { services: true } } },
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
  return {
    id: row.id,
    projectName: row.projectName,
    slug: row.slug,
    projectDescription: row.projectDescription,
    environmentCount: row._count.environments,
    serviceCount: row.environments.reduce((n, e) => n + e._count.services, 0),
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
      serviceCount: e._count.services,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}
