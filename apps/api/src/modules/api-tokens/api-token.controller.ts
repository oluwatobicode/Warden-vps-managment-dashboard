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
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { ApiTokenService } from './api-token.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { type CreateApiTokenInput, CreateApiTokenSchema } from 'shared-types';
import { UuidPipe } from '../../common/pipes/uuid.pipe';

@Controller('api-tokens')
@UseGuards(SessionGuard, RolesGuard)
@Roles('ADMIN')
export class ApiTokenController {
  constructor(private readonly apiToken: ApiTokenService) {}

  @Post()
  create(
    @CurrentOrg() orgId: string,
    @Body(new ZodValidationPipe(CreateApiTokenSchema))
    body: CreateApiTokenInput,
  ) {
    return this.apiToken.createToken(orgId, body);
  }

  @Get()
  list(@CurrentOrg() orgId: string) {
    return this.apiToken.listTokens(orgId);
  }

  @Delete(':id')
  @HttpCode(204)
  async revoke(@CurrentOrg() orgId: string, @Param('id', UuidPipe) id: string) {
    await this.apiToken.revokeToken(orgId, id);
  }
}
