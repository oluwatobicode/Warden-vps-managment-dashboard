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
  CreateDatabaseSchema,
  DeleteDatabaseSchema,
  type CreateDatabaseInput,
  type DeleteDatabaseInput,
  UpdateBackupSettingsSchema,
  type UpdateBackupSettingsInput,
} from 'shared-types';
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { Actor } from '../../common/types/actor';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { DATABASE_MESSAGES } from '../../common/constants/messages.config';
import { DatabaseService } from './database.service';

/**
 * /databases : databases as a service. Everyone can view; Developer and up
 * can create, restart, delete (including the data) and reveal the connection
 * string (decided 2026-10-21).
 */
@Controller('databases')
@UseGuards(SessionGuard, RolesGuard)
export class DatabaseController {
  constructor(private readonly databases: DatabaseService) {}

  /** 202: the service exists now; the worker starts the container. */
  @Post()
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  @HttpCode(202)
  create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(CreateDatabaseSchema))
    body: CreateDatabaseInput,
  ) {
    return this.databases.create(actor, body);
  }

  @Get(':serviceId')
  info(
    @CurrentOrg() orgId: string,
    @Param('serviceId', UuidPipe) serviceId: string,
  ) {
    return this.databases.info(orgId, serviceId);
  }

  @Post(':serviceId/restart')
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  @HttpCode(202)
  restart(
    @CurrentActor() actor: Actor,
    @Param('serviceId', UuidPipe) serviceId: string,
  ) {
    return this.databases.restart(actor, serviceId);
  }

  @Delete(':serviceId')
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  @HttpCode(202)
  async remove(
    @CurrentActor() actor: Actor,
    @Param('serviceId', UuidPipe) serviceId: string,
    @Body(new ZodValidationPipe(DeleteDatabaseSchema))
    body: DeleteDatabaseInput,
  ) {
    await this.databases.remove(actor, serviceId, body);
    return { message: DATABASE_MESSAGES.deleting };
  }

  @Patch(':serviceId/backup-settings')
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  backupSettings(
    @CurrentActor() actor: Actor,
    @Param('serviceId', UuidPipe) serviceId: string,
    @Body(new ZodValidationPipe(UpdateBackupSettingsSchema))
    body: UpdateBackupSettingsInput,
  ) {
    return this.databases.updateBackupSettings(actor, serviceId, body);
  }

  @Get(':serviceId/connection')
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  connection(
    @CurrentActor() actor: Actor,
    @Param('serviceId', UuidPipe) serviceId: string,
  ) {
    return this.databases.connection(actor, serviceId);
  }
}
