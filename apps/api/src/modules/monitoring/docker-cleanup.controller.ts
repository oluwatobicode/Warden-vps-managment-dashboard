import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { StartCleanupSchema, type StartCleanupInput } from 'shared-types';
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { Actor } from '../../common/types/actor';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { RATE_LIMIT, throttle } from '../../common/constants/constants.config';
import { CleanupService } from './cleanup.service';

/**
 * Docker cleanup. Servers are DEV_OPS territory, so previewing (an SSH login)
 * and running a cleanup need DEV_OPS; the history is visible to everyone.
 */
@Controller('docker-cleanups')
@UseGuards(SessionGuard, RolesGuard)
export class DockerCleanupController {
  constructor(private readonly cleanups: CleanupService) {}

  @Get()
  list(
    @CurrentOrg() orgId: string,
    @Query('serverId', UuidPipe) serverId: string,
  ) {
    return this.cleanups.list(orgId, serverId);
  }

  @Get('preview')
  @Roles('ADMIN', 'DEV_OPS')
  @Throttle(throttle(RATE_LIMIT.serverSsh))
  preview(
    @CurrentOrg() orgId: string,
    @Query('serverId', UuidPipe) serverId: string,
  ) {
    return this.cleanups.preview(orgId, serverId);
  }

  /** 202: queued for the worker, not done yet. Poll GET /docker-cleanups?serverId= for the result. */
  @Post()
  @Roles('ADMIN', 'DEV_OPS')
  @Throttle(throttle(RATE_LIMIT.serverSsh))
  @HttpCode(202)
  start(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(StartCleanupSchema)) body: StartCleanupInput,
  ) {
    return this.cleanups.start(actor, body.serverId);
  }
}
