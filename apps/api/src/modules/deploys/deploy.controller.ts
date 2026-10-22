import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  AddDomainSchema,
  CreateFromRepoSchema,
  type AddDomainInput,
  type CreateFromRepoInput,
  TriggerDeploySchema,
  UpdateDeploySettingsSchema,
  type TriggerDeployInput,
  type UpdateDeploySettingsInput,
} from 'shared-types';
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { Actor } from '../../common/types/actor';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { DeployService } from './deploy.service';
import { RepoServicesService } from './repo-services.service';
import { AppControlService } from './app-control.service';

/**
 * App deploys. Everyone can watch; Developer and up deploy, roll back, cancel
 * and change build settings; DevOps and up set up a server's proxy.
 */
@Controller()
@UseGuards(SessionGuard, RolesGuard)
export class DeployController {
  constructor(
    private readonly deploys: DeployService,
    private readonly repoServices: RepoServicesService,
    private readonly apps: AppControlService,
  ) {}

  /** Stop: the live version stops serving; nothing is deleted. */
  @Post('services/:id/stop')
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  @HttpCode(204)
  async stop(@CurrentActor() actor: Actor, @Param('id', UuidPipe) id: string) {
    await this.apps.stop(actor, id);
  }

  /** Start: the version that was live runs again. */
  @Post('services/:id/start')
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  @HttpCode(204)
  async start(@CurrentActor() actor: Actor, @Param('id', UuidPipe) id: string) {
    await this.apps.start(actor, id);
  }

  /** Add service → From GitHub: the picked apps become services, and (by default) deploy. */
  @Post('services/from-repo')
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  @HttpCode(201)
  fromRepo(@CurrentActor() actor: Actor, @Body(new ZodValidationPipe(CreateFromRepoSchema)) body: CreateFromRepoInput) {
    return this.repoServices.create(actor, body);
  }

  /** 202: Deployment #N is queued; the worker does the rest. */
  @Post('deployments')
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  @HttpCode(202)
  trigger(@CurrentActor() actor: Actor, @Body(new ZodValidationPipe(TriggerDeploySchema)) body: TriggerDeployInput) {
    return this.deploys.trigger(actor, body);
  }

  @Get('deployments')
  list(@CurrentOrg() orgId: string, @Query('serviceId', UuidPipe) serviceId: string) {
    return this.deploys.list(orgId, serviceId);
  }

  @Get('deployments/:id')
  detail(@CurrentOrg() orgId: string, @Param('id', UuidPipe) id: string) {
    return this.deploys.detail(orgId, id);
  }

  /** Saved output after chunk `after` (0 = from the start). Live lines come over Socket.io. */
  @Get('deployments/:id/logs')
  logs(@CurrentOrg() orgId: string, @Param('id', UuidPipe) id: string, @Query('after') after?: string) {
    const n = Number(after ?? 0);
    return this.deploys.logs(orgId, id, Number.isInteger(n) && n > 0 ? n : 0);
  }

  @Post('deployments/:id/rollback')
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  @HttpCode(202)
  rollback(@CurrentActor() actor: Actor, @Param('id', UuidPipe) id: string) {
    return this.deploys.rollback(actor, id);
  }

  @Post('deployments/:id/cancel')
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  cancel(@CurrentActor() actor: Actor, @Param('id', UuidPipe) id: string) {
    return this.deploys.cancel(actor, id);
  }

  @Get('services/:id/deploy-settings')
  info(@CurrentOrg() orgId: string, @Param('id', UuidPipe) id: string) {
    return this.deploys.info(orgId, id);
  }

  @Patch('services/:id/deploy-settings')
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  updateSettings(
    @CurrentActor() actor: Actor,
    @Param('id', UuidPipe) id: string,
    @Body(new ZodValidationPipe(UpdateDeploySettingsSchema)) body: UpdateDeploySettingsInput,
  ) {
    return this.deploys.updateSettings(actor, id, body);
  }

  @Post('service-domains')
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  addDomain(@CurrentActor() actor: Actor, @Body(new ZodValidationPipe(AddDomainSchema)) body: AddDomainInput) {
    return this.deploys.addDomain(actor, body);
  }

  @Post('service-domains/:id/verify')
  verifyDomain(@CurrentOrg() orgId: string, @Param('id', UuidPipe) id: string) {
    return this.deploys.verifyDomain(orgId, id);
  }

  @Delete('service-domains/:id')
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  @HttpCode(204)
  async removeDomain(@CurrentActor() actor: Actor, @Param('id', UuidPipe) id: string) {
    await this.deploys.removeDomain(actor, id);
  }

  @Get('servers/:id/proxy')
  proxyStatus(@CurrentOrg() orgId: string, @Param('id', UuidPipe) id: string, @Query('jobId') jobId?: string) {
    return this.deploys.proxyStatus(orgId, id, jobId && /^\d+$/.test(jobId) ? jobId : undefined);
  }

  /** 202: the worker starts Traefik on the server; poll GET with the jobId. */
  @Post('servers/:id/proxy')
  @Roles('ADMIN', 'DEV_OPS')
  @HttpCode(202)
  setupProxy(@CurrentActor() actor: Actor, @Param('id', UuidPipe) id: string) {
    return this.deploys.setupProxy(actor, id);
  }
}
