import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { SaveProxyConfigSchema, type SaveProxyConfigInput } from 'shared-types';
import { z } from 'zod';
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { Actor } from '../../common/types/actor';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { ProxyConfigService } from './proxy.service';

const CheckSchema = SaveProxyConfigSchema.pick({ form: true, raw: true });
const RevertSchema = z.object({ baseVersionId: z.uuid().nullable() });

/**
 * /servers/:id/proxy-config : a server's Traefik config (warden.yml).
 * Everyone can see it and the live routes; changing it is DevOps and up,
 * like the rest of a server's setup.
 */
@Controller('servers/:id/proxy-config')
@UseGuards(SessionGuard, RolesGuard)
export class ProxyConfigController {
  constructor(private readonly proxy: ProxyConfigService) {}

  @Get()
  view(@CurrentOrg() orgId: string, @Param('id', UuidPipe) id: string) {
    return this.proxy.view(orgId, id);
  }

  @Post('check')
  @Roles('ADMIN', 'DEV_OPS')
  check(@CurrentOrg() orgId: string, @Param('id', UuidPipe) id: string, @Body(new ZodValidationPipe(CheckSchema)) body: Pick<SaveProxyConfigInput, 'form' | 'raw'>) {
    return this.proxy.check(orgId, id, body);
  }

  @Put()
  @Roles('ADMIN', 'DEV_OPS')
  apply(@CurrentActor() actor: Actor, @Param('id', UuidPipe) id: string, @Body(new ZodValidationPipe(SaveProxyConfigSchema)) body: SaveProxyConfigInput) {
    return this.proxy.apply(actor, id, body, body.raw.trim() ? 'RAW' : 'FORM');
  }

  @Post('revert/:versionId')
  @Roles('ADMIN', 'DEV_OPS')
  revert(
    @CurrentActor() actor: Actor,
    @Param('id', UuidPipe) id: string,
    @Param('versionId', UuidPipe) versionId: string,
    @Body(new ZodValidationPipe(RevertSchema)) body: { baseVersionId: string | null },
  ) {
    return this.proxy.revert(actor, id, versionId, body.baseVersionId);
  }
}
