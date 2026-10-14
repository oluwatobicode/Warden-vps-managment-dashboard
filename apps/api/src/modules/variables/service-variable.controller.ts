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
import {
  CreateServiceVariableSchema,
  UpdateVariableSchema,
  type CreateServiceVariableInput,
  type UpdateVariableInput,
} from 'shared-types';
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { Actor } from '../../common/types/actor';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { VariableService } from './variable.service';

@Controller('service-variables')
@UseGuards(SessionGuard, RolesGuard)
export class ServiceVariableController {
  constructor(private readonly variables: VariableService) {}

  @Get()
  list(
    @CurrentOrg() orgId: string,
    @Query('serviceId', UuidPipe) serviceId: string,
  ) {
    return this.variables.listForService(orgId, serviceId);
  }

  // Declared BEFORE any ':id' GET: Nest matches top to bottom, and ':id' would
  // otherwise swallow the word "resolved".
  @Get('resolved')
  resolved(
    @CurrentOrg() orgId: string,
    @Query('serviceId', UuidPipe) serviceId: string,
  ) {
    return this.variables.resolveForService(orgId, serviceId);
  }

  @Post()
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  create(
    @CurrentOrg() orgId: string,
    @Body(new ZodValidationPipe(CreateServiceVariableSchema))
    body: CreateServiceVariableInput,
  ) {
    return this.variables.createForService(orgId, body);
  }

  @Get(':id/reveal')
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  reveal(
    @CurrentActor() actor: Actor,
    @Param('id', UuidPipe) id: string,
  ) {
    return this.variables.revealServiceVariable(actor, id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  update(
    @CurrentOrg() orgId: string,
    @Param('id', UuidPipe) id: string,
    @Body(new ZodValidationPipe(UpdateVariableSchema))
    body: UpdateVariableInput,
  ) {
    return this.variables.updateServiceVariable(orgId, id, body);
  }

  @Delete(':id')
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  @HttpCode(204)
  async remove(@CurrentOrg() orgId: string, @Param('id', UuidPipe) id: string) {
    await this.variables.deleteServiceVariable(orgId, id);
  }
}
