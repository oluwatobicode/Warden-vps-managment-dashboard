import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import {
  InviteMemberSchema,
  UpdateMemberRoleSchema,
  type InviteMemberInput,
  type UpdateMemberRoleInput,
} from 'shared-types';
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RATE_LIMIT, throttle } from '../../common/constants/constants.config';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TeamService } from './team.service';

const UuidPipe = new ZodValidationPipe(z.string().uuid());
const AllFlag = z
  .string()
  .optional()
  .transform((v) => v === 'true');

@Controller('team')
@UseGuards(SessionGuard, RolesGuard)
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get('members')
  listMembers(@CurrentOrg() orgId: string) {
    return this.team.listMembers(orgId);
  }

  @Throttle(throttle(RATE_LIMIT.magicLink))
  @Post('invitations')
  @Roles('ADMIN')
  invite(
    @CurrentOrg() orgId: string,
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(InviteMemberSchema)) body: InviteMemberInput,
  ) {
    return this.team.inviteMember(orgId, userId, body);
  }

  // ?all=true → full history (accepted / declined / revoked / expired too).
  @Get('invitations')
  @Roles('ADMIN')
  listInvitations(
    @CurrentOrg() orgId: string,
    @Query('all', new ZodValidationPipe(AllFlag)) all: boolean,
  ) {
    return this.team.listInvitations(orgId, all);
  }

  @Delete('invitations/:id')
  @Roles('ADMIN')
  @HttpCode(204)
  async revoke(@CurrentOrg() orgId: string, @Param('id', UuidPipe) id: string) {
    await this.team.revokeInvitation(orgId, id);
  }

  @Throttle(throttle(RATE_LIMIT.magicLink))
  @Post('invitations/:id/resend')
  @Roles('ADMIN')
  @HttpCode(200)
  async resendInvite(
    @CurrentOrg() orgId: string,
    @Param('id', UuidPipe) id: string,
  ) {
    return this.team.resendInvitation(orgId, id);
  }

  @Patch('members/:id/role')
  @Roles('ADMIN')
  updateMemberRole(
    @CurrentOrg() orgId: string,
    @CurrentUser() userId: string,
    @Param('id', UuidPipe) id: string,
    @Body(new ZodValidationPipe(UpdateMemberRoleSchema))
    body: UpdateMemberRoleInput,
  ) {
    return this.team.updateMemberRole(orgId, userId, id, body.role);
  }

  // Suspends the membership (never deletes) and logs them out everywhere.
  @Delete('members/:id')
  @Roles('ADMIN')
  @HttpCode(204)
  async removeMember(
    @CurrentOrg() orgId: string,
    @CurrentUser() userId: string,
    @Param('id', UuidPipe) id: string,
  ) {
    await this.team.removeMember(orgId, userId, id);
  }
}
