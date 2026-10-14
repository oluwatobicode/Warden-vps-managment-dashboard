import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateSshKeySchema, type CreateSshKeyInput } from 'shared-types';
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { Actor } from '../../common/types/actor';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { SshKeyService } from './ssh-keys.service';

@Controller('ssh-keys')
@UseGuards(SessionGuard, RolesGuard)
export class SshKeyController {
  constructor(private readonly sshKeys: SshKeyService) {}

  @Get()
  list(@CurrentOrg() orgId: string) {
    return this.sshKeys.listSshKeys(orgId);
  }

  @Post()
  @Roles('ADMIN', 'DEV_OPS')
  create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(CreateSshKeySchema)) body: CreateSshKeyInput,
  ) {
    return this.sshKeys.createSshKey(actor, body);
  }

  @Delete(':id')
  @Roles('ADMIN', 'DEV_OPS')
  @HttpCode(204)
  async remove(
    @CurrentActor() actor: Actor,
    @Param('id', UuidPipe) id: string,
  ) {
    await this.sshKeys.deleteSshKey(actor, id);
  }
}
