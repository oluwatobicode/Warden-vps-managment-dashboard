import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { Actor } from '../../common/types/actor';
import { ApiTokenService } from './api-token.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  type ApiTokenWhoami,
  type CreateApiTokenInput,
  CreateApiTokenSchema,
} from 'shared-types';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { ApiTokenGuard } from '../../common/guards/api-token.guard';
import type { AuthenticatedRequest } from '../../common/types/request';

@Controller('api-tokens')
@UseGuards(SessionGuard, RolesGuard)
@Roles('ADMIN')
export class ApiTokenController {
  constructor(private readonly apiToken: ApiTokenService) {}

  @Post()
  create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(CreateApiTokenSchema))
    body: CreateApiTokenInput,
  ) {
    return this.apiToken.createToken(actor, body);
  }

  @Get()
  list(@CurrentOrg() orgId: string) {
    return this.apiToken.listTokens(orgId);
  }

  @Delete(':id')
  @HttpCode(204)
  async revoke(
    @CurrentActor() actor: Actor,
    @Param('id', UuidPipe) id: string,
  ) {
    await this.apiToken.revokeToken(actor, id);
  }
}

@Controller('api-tokens')
@UseGuards(ApiTokenGuard)
export class ApiTokenWhoamiController {
  @Get('whoami')
  whoami(@Req() req: AuthenticatedRequest): ApiTokenWhoami {
    return {
      tokenId: req.apiTokenId!,
      organizationId: req.session!.organizationId,
      role: req.session!.role,
    };
  }
}
