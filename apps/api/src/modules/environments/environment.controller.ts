import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { EnvironmentService } from './environment.service';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  type CreateEnvironmentInput,
  type UpdateEnvironmentInput,
  CreateEnvironmentSchema,
  UpdateEnvironmentSchema,
} from 'shared-types';

@Controller('environments')
@UseGuards(SessionGuard, RolesGuard)
export class EnvironmentController {
  constructor(private readonly environments: EnvironmentService) {}

  @Get()
  list(
    @CurrentOrg() orgId: string,
    @Query('projectId', UuidPipe) projectId: string,
  ) {
    return this.environments.listEnvironments(orgId, projectId);
  }

  @Get(':id')
  get(@CurrentOrg() orgId: string, @Param('id', UuidPipe) id: string) {
    return this.environments.getEnvironment(orgId, id);
  }

  @Post()
  @Roles('ADMIN', 'DEV_OPS')
  create(
    @CurrentOrg() orgId: string,
    @Body(new ZodValidationPipe(CreateEnvironmentSchema))
    body: CreateEnvironmentInput,
  ) {
    return this.environments.createEnvironment(orgId, body);
  }

  @Patch(':id')
  @Roles('ADMIN', 'DEV_OPS')
  update(
    @CurrentOrg() orgId: string,
    @Param('id', UuidPipe) id: string,
    @Body(new ZodValidationPipe(UpdateEnvironmentSchema))
    body: UpdateEnvironmentInput,
  ) {
    return this.environments.updateEnvironment(orgId, id, body);
  }

  @Delete(':id')
  @Roles('ADMIN', 'DEV_OPS')
  @HttpCode(204)
  async remove(@CurrentOrg() orgId: string, @Param('id', UuidPipe) id: string) {
    await this.environments.deleteEnvironment(orgId, id);
  }
}
