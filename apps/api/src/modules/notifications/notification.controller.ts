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
import { Throttle } from '@nestjs/throttler';
import {
  CreateNotificationChannelSchema,
  UpdateNotificationChannelSchema,
  type CreateNotificationChannelInput,
  type UpdateNotificationChannelInput,
} from 'shared-types';
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { Actor } from '../../common/types/actor';
import { RATE_LIMIT, throttle } from '../../common/constants/constants.config';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { NotificationService } from './notification.service';

@Controller('notification-channels')
@UseGuards(SessionGuard, RolesGuard)
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  list(@CurrentOrg() orgId: string) {
    return this.notifications.list(orgId);
  }

  @Post()
  @Roles('ADMIN')
  create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(CreateNotificationChannelSchema))
    body: CreateNotificationChannelInput,
  ) {
    return this.notifications.create(actor, body);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @CurrentActor() actor: Actor,
    @Param('id', UuidPipe) id: string,
    @Body(new ZodValidationPipe(UpdateNotificationChannelSchema))
    body: UpdateNotificationChannelInput,
  ) {
    return this.notifications.update(actor, id, body);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(204)
  async remove(
    @CurrentActor() actor: Actor,
    @Param('id', UuidPipe) id: string,
  ) {
    await this.notifications.remove(actor, id);
  }

  @Get(':id/reveal')
  @Roles('ADMIN')
  reveal(@CurrentActor() actor: Actor, @Param('id', UuidPipe) id: string) {
    return this.notifications.reveal(actor, id);
  }

  // Limited: each call makes the server POST to a third party.
  @Throttle(throttle(RATE_LIMIT.login))
  @Post(':id/test')
  @Roles('ADMIN')
  @HttpCode(200)
  test(@CurrentOrg() orgId: string, @Param('id', UuidPipe) id: string) {
    return this.notifications.test(orgId, id);
  }
}
