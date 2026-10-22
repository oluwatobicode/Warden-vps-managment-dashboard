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
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { Actor } from '../../common/types/actor';
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
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(CreateEnvironmentSchema))
    body: CreateEnvironmentInput,
  ) {
    return this.environments.createEnvironment(actor, body);
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
  async remove(
    @CurrentActor() actor: Actor,
    @Param('id', UuidPipe) id: string,
    @Query('force') force?: string,
  ) {
    await this.environments.deleteEnvironment(actor, id, force === 'true');
  }
}
