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
import { z } from 'zod';
import { InviteMemberSchema, type InviteMemberInput } from 'shared-types';
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TeamService } from './team.service';

const UuidPipe = new ZodValidationPipe(z.string().uuid());

@Controller('team')
@UseGuards(SessionGuard, RolesGuard)
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get('members')
  listMembers(@CurrentOrg() orgId: string) {
    return this.team.listMembers(orgId);
  }

  @Post('invitations')
  @Roles('ADMIN')
  invite(
    @CurrentOrg() orgId: string,
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(InviteMemberSchema)) body: InviteMemberInput,
  ) {
    return this.team.inviteMember(orgId, userId, body);
  }

  @Get('invitations')
  @Roles('ADMIN')
  listInvitations(@CurrentOrg() orgId: string) {
    return this.team.listInvitations(orgId);
  }

  @Delete('invitations/:id')
  @Roles('ADMIN')
  @HttpCode(204)
  async revoke(@CurrentOrg() orgId: string, @Param('id', UuidPipe) id: string) {
    await this.team.revokeInvitation(orgId, id);
  }
}
