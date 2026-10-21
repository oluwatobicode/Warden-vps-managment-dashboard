import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RestoreBackupSchema, type RestoreBackupInput } from 'shared-types';
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { Actor } from '../../common/types/actor';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { DatabaseBackupService } from './database-backup.service';

/**
 * /database-backups : everyone can see the list; Developer and up can back up,
 * restore and download (same as the rest of databases, decided 2026-10-21).
 */
@Controller('database-backups')
@UseGuards(SessionGuard, RolesGuard)
export class DatabaseBackupController {
  constructor(private readonly backups: DatabaseBackupService) {}

  @Get()
  list(
    @CurrentOrg() orgId: string,
    @Query('serviceId', UuidPipe) serviceId: string,
  ) {
    return this.backups.list(orgId, serviceId);
  }

  /** 202: the row exists now; the worker does the dump. */
  @Post()
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  @HttpCode(202)
  backupNow(
    @CurrentActor() actor: Actor,
    @Body('serviceId', UuidPipe) serviceId: string,
  ) {
    return this.backups.backupNow(actor, serviceId);
  }

  @Post(':id/restore')
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  @HttpCode(202)
  restore(
    @CurrentActor() actor: Actor,
    @Param('id', UuidPipe) id: string,
    @Body(new ZodValidationPipe(RestoreBackupSchema)) body: RestoreBackupInput,
  ) {
    return this.backups.restore(actor, id, body);
  }

  /** The raw file, not the JSON envelope. */
  @Get(':id/download')
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  download(@CurrentActor() actor: Actor, @Param('id', UuidPipe) id: string) {
    return this.backups.download(actor, id);
  }
}
