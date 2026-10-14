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
  CreateServerSchema,
  UpdateServerSchema,
  type CreateServerInput,
  type UpdateServerInput,
} from 'shared-types';
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { Actor } from '../../common/types/actor';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { ServerService } from './servers.service';
import { Throttle } from '@nestjs/throttler';
import { RATE_LIMIT, throttle } from '../../common/constants/constants.config';

@Controller('servers')
@UseGuards(SessionGuard, RolesGuard)
export class ServerController {
  constructor(private readonly servers: ServerService) {}

  @Get()
  list(@CurrentOrg() orgId: string) {
    return this.servers.listServers(orgId);
  }

  @Get(':id')
  get(@CurrentOrg() orgId: string, @Param('id', UuidPipe) id: string) {
    return this.servers.getServer(orgId, id);
  }

  @Post()
  @Roles('ADMIN', 'DEV_OPS')
  create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(CreateServerSchema)) body: CreateServerInput,
  ) {
    return this.servers.createServer(actor, body);
  }

  @Patch(':id')
  @Roles('ADMIN', 'DEV_OPS')
  update(
    @CurrentOrg() orgId: string,
    @Param('id', UuidPipe) id: string,
    @Body(new ZodValidationPipe(UpdateServerSchema)) body: UpdateServerInput,
  ) {
    return this.servers.updateServer(orgId, id, body);
  }

  @Throttle(throttle(RATE_LIMIT.login))
  @Post(':id/test')
  @Roles('ADMIN', 'DEV_OPS')
  @HttpCode(200)
  test(@CurrentOrg() orgId: string, @Param('id', UuidPipe) id: string) {
    return this.servers.testConnection(orgId, id);
  }

  @Delete(':id')
  @Roles('ADMIN', 'DEV_OPS')
  @HttpCode(204)
  async remove(
    @CurrentActor() actor: Actor,
    @Param('id', UuidPipe) id: string,
  ) {
    await this.servers.deleteServer(actor, id);
  }
}
