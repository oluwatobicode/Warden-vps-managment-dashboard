import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from 'shared-types';
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { ProjectService } from './project.service';

@Controller('projects')
@UseGuards(SessionGuard, RolesGuard)
export class ProjectController {
  constructor(private readonly projects: ProjectService) {}

  @Get()
  list(@CurrentOrg() orgId: string) {
    return this.projects.listProjects(orgId);
  }

  @Get(':id')
  get(@CurrentOrg() orgId: string, @Param('id', UuidPipe) id: string) {
    return this.projects.getProject(orgId, id);
  }

  @Post()
  @Roles('ADMIN', 'DEV_OPS')
  create(
    @CurrentOrg() orgId: string,
    @Body(new ZodValidationPipe(CreateProjectSchema)) body: CreateProjectInput,
  ) {
    return this.projects.createProject(orgId, body);
  }

  @Patch(':id')
  @Roles('ADMIN', 'DEV_OPS')
  update(
    @CurrentOrg() orgId: string,
    @Param('id', UuidPipe) id: string,
    @Body(new ZodValidationPipe(UpdateProjectSchema)) body: UpdateProjectInput,
  ) {
    return this.projects.updateProject(orgId, id, body);
  }

  @Delete(':id')
  @Roles('ADMIN', 'DEV_OPS')
  @HttpCode(204)
  async remove(@CurrentOrg() orgId: string, @Param('id', UuidPipe) id: string) {
    await this.projects.deleteProject(orgId, id);
  }
}
