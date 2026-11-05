import { Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  PlatformDeploysQuerySchema,
  PlatformOrgsQuerySchema,
  PlatformUsersQuerySchema,
  type PlatformDeploysQuery,
  type PlatformOrgsQuery,
  type PlatformUsersQuery,
} from 'shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SessionGuard } from '../../common/guards/session.guard';
import { PlatformOwnerGuard } from '../../common/guards/platform-owner.guard';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PlatformUsersService } from './platform-users.service';
import { PlatformService } from './platform.service';

/**
 * /platform : the platform owner's view across every org. Cookie session only
 * (no @TokenAllowed, and SessionGuard never reads a Bearer header), then
 * PlatformOwnerGuard checks User.platformRole in Postgres: anyone else gets a 404.
 * Guards run before pipes, so a bad query is a 400 only for the owner.
 */
@Controller('platform')
@UseGuards(SessionGuard, PlatformOwnerGuard)
export class PlatformController {
  constructor(
    private readonly platform: PlatformService,
    private readonly people: PlatformUsersService,
  ) {}

  @Get('overview')
  overview() {
    return this.platform.overview();
  }

  @Get('orgs')
  orgs(@Query(new ZodValidationPipe(PlatformOrgsQuerySchema)) query: PlatformOrgsQuery) {
    return this.platform.orgs(query.sort, query.cursor);
  }

  @Get('users')
  users(@Query(new ZodValidationPipe(PlatformUsersQuerySchema)) query: PlatformUsersQuery) {
    return this.people.users(query);
  }

  @Get('users/:id')
  user(@Param('id', UuidPipe) id: string) {
    return this.people.user(id);
  }

  /** The only route that returns an email: one user's, and every call is logged (PlatformAccessLog). */
  @Post('users/:id/email')
  @HttpCode(200)
  revealEmail(@CurrentUser() actorUserId: string, @Param('id', UuidPipe) id: string) {
    return this.people.revealEmail(actorUserId, id);
  }

  @Get('deploys')
  deploys(@Query(new ZodValidationPipe(PlatformDeploysQuerySchema)) query: PlatformDeploysQuery) {
    return this.people.deploys(query.status, query.cursor);
  }

  @Get('health')
  health() {
    return this.platform.health();
  }
}
