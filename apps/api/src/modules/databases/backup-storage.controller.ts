import { Body, Controller, Delete, Get, Put, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  SaveBackupStorageSchema,
  type SaveBackupStorageInput,
} from 'shared-types';
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { Actor } from '../../common/types/actor';
import { RATE_LIMIT, throttle } from '../../common/constants/constants.config';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { BackupStorageService } from './backup-storage.service';

/**
 * /backup-storage : the org's own bucket for database backups. Infrastructure,
 * so DevOps and up change it (like servers and SSH keys); everyone may see
 * where backups go. The secret key is never returned.
 */
@Controller('backup-storage')
@UseGuards(SessionGuard, RolesGuard)
@Roles('ADMIN', 'DEV_OPS')
export class BackupStorageController {
  constructor(private readonly storage: BackupStorageService) {}

  @Get()
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER', 'VIEWER')
  status(@CurrentOrg() orgId: string) {
    return this.storage.status(orgId);
  }

  /** Tests a write to the bucket before saving. */
  @Put()
  @Throttle(throttle(RATE_LIMIT.login))
  save(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(SaveBackupStorageSchema))
    body: SaveBackupStorageInput,
  ) {
    return this.storage.save(actor, body);
  }

  @Delete()
  remove(@CurrentActor() actor: Actor) {
    return this.storage.remove(actor);
  }
}
