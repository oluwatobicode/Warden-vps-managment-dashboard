import { Controller, Delete, Get, Headers, HttpCode, Param, Post, Query, Req, Res, UseGuards, type RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { InspectRepoQuerySchema, type InspectRepoQuery } from 'shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { Actor } from '../../common/types/actor';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { GithubService } from './github.service';

/**
 * /github : the Warden GitHub App. Connecting is infrastructure (DevOps and
 * up); everyone sees what's connected; Developer and up pick repos.
 */
@Controller('github')
export class GithubController {
  constructor(private readonly github: GithubService) {}

  @Get('status')
  @UseGuards(SessionGuard)
  status(@CurrentOrg() orgId: string) {
    return this.github.status(orgId);
  }

  @Post('install')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('ADMIN', 'DEV_OPS')
  install(@CurrentActor() actor: Actor) {
    return this.github.startInstall(actor);
  }

  /** GitHub's "Setup URL": the browser comes back here, then goes on to Settings → GitHub. */
  @Get('callback')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('ADMIN', 'DEV_OPS')
  async callback(
    @CurrentActor() actor: Actor,
    @Query('installation_id') installationId: string,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    try {
      if (!/^\d+$/.test(installationId ?? '')) throw new Error('Missing installation');
      const account = await this.github.finishInstall(actor, Number(installationId), state);
      res.redirect(this.github.settingsUrl(`?connected=${encodeURIComponent(account)}`));
    } catch (e) {
      res.redirect(this.github.settingsUrl(`?error=${encodeURIComponent((e as Error).message)}`));
    }
  }

  /** Read a repo and list its apps with suggested settings (for Add service). */
  @Get('inspect')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  inspect(@CurrentOrg() orgId: string, @Query(new ZodValidationPipe(InspectRepoQuerySchema)) q: InspectRepoQuery) {
    return this.github.inspect(orgId, q);
  }

  @Delete('installations/:id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('ADMIN', 'DEV_OPS')
  @HttpCode(204)
  async disconnect(@CurrentActor() actor: Actor, @Param('id', UuidPipe) id: string) {
    await this.github.disconnect(actor, id);
  }

  @Get('installations/:id/repos')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  repos(@CurrentOrg() orgId: string, @Param('id', UuidPipe) id: string) {
    return this.github.repos(orgId, id);
  }

  @Get('installations/:id/branches')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  branches(@CurrentOrg() orgId: string, @Param('id', UuidPipe) id: string, @Query('repo') repo: string) {
    return this.github.branches(orgId, id, repo ?? '');
  }

  /** Public: GitHub calls this. The signature check in the service is the guard. */
  @Post('webhook')
  @HttpCode(200)
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-github-event') event: string | undefined,
    @Headers('x-hub-signature-256') signature: string | undefined,
  ) {
    return this.github.webhook(req.rawBody, event, signature);
  }
}
