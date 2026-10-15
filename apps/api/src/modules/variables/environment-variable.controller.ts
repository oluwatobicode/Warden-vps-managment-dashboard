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
  CreateEnvironmentVariableSchema,
  UpdateVariableSchema,
  type CreateEnvironmentVariableInput,
  type UpdateVariableInput,
  BulkEnvironmentVariablesSchema,
  type BulkEnvironmentVariablesInput,
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

// Developers own services and their variables (role table): they read, write
// and reveal. Viewers can list (secrets stay masked) but not reveal or change.
@Controller('environment-variables')
@UseGuards(SessionGuard, RolesGuard)
export class EnvironmentVariableController {
  constructor(private readonly variables: VariableService) {}

  @Get()
  list(
    @CurrentOrg() orgId: string,
    @Query('environmentId', UuidPipe) environmentId: string,
  ) {
    return this.variables.listForEnvironment(orgId, environmentId);
  }

  @Post()
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  create(
    @CurrentOrg() orgId: string,
    @Body(new ZodValidationPipe(CreateEnvironmentVariableSchema))
    body: CreateEnvironmentVariableInput,
  ) {
    return this.variables.createForEnvironment(orgId, body);
  }

  // One request, one transaction: the whole .env goes in, or none of it does.
  @Post('bulk')
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  @HttpCode(200)
  bulkImport(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(BulkEnvironmentVariablesSchema))
    body: BulkEnvironmentVariablesInput,
  ) {
    return this.variables.importForEnvironment(actor, body);
  }

  @Get(':id/reveal')
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  reveal(
    @CurrentActor() actor: Actor,
    @Param('id', UuidPipe) id: string,
  ) {
    return this.variables.revealEnvironmentVariable(actor, id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  update(
    @CurrentOrg() orgId: string,
    @Param('id', UuidPipe) id: string,
    @Body(new ZodValidationPipe(UpdateVariableSchema))
    body: UpdateVariableInput,
  ) {
    return this.variables.updateEnvironmentVariable(orgId, id, body);
  }

  @Delete(':id')
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  @HttpCode(204)
  async remove(@CurrentOrg() orgId: string, @Param('id', UuidPipe) id: string) {
    await this.variables.deleteEnvironmentVariable(orgId, id);
  }
}
