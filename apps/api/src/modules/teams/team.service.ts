import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role } from 'db';
import type { Invitation, InviteMemberInput, Member } from 'shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { SessionService } from '../auth/session/session.service';
import { TEAM_MESSAGES } from '../../common/constants/messages.config';
import { randomToken, sha256 } from '../../common/utils/token.util';
import {
  INVITATION_TTL_DAYS,
  ROLE_LABEL,
  TTL_SECONDS,
} from '../../common/constants/constants.config';

const INVITE_CONTEXT = {
  organization: { select: { organizationName: true } },
  invitedBy: { select: { firstName: true, lastName: true } },
} satisfies Prisma.InvitationInclude;

type InviteWithContext = Prisma.InvitationGetPayload<{
  include: typeof INVITE_CONTEXT;
}>;

type MembershipWithUser = Prisma.MembershipGetPayload<{
  include: { user: true };
}>;

function toMember(row: MembershipWithUser): Member {
  return {
    id: row.id,
    userId: row.userId,
    email: row.user.email,
    firstName: row.user.firstName,
    lastName: row.user.lastName,
    role: row.role,
    status: row.status,
    joinedAt: row.createdAt.toISOString(),
  };
}

function toInvitation(row: {
  id: string;
  email: string;
  role: Invitation['role'];
  status: Invitation['status'];
  expiresAt: Date;
  createdAt: Date;
}): Invitation {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class TeamService {
  private readonly appUrl: string;

  private readonly logger = new Logger(TeamService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly sessions: SessionService,
    config: ConfigService,
  ) {
    this.appUrl = config.getOrThrow<string>('APP_URL');
  }

  //  Members
  async listMembers(orgId: string): Promise<Member[]> {
    const rows = await this.prisma.client.membership.findMany({
      where: { organizationId: orgId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toMember);
  }

  private async sendInviteEmail(
    invite: InviteWithContext,
    raw: string,
  ): Promise<void> {
    await this.mail.sendInvite({
      inviteeEmail: invite.email,
      inviterName: invite.invitedBy
        ? `${invite.invitedBy.firstName} ${invite.invitedBy.lastName}`.trim()
        : 'A workspace admin',
      organizationName: invite.organization.organizationName,
      roleLabel: ROLE_LABEL[invite.role] ?? invite.role,
      acceptUrl: `${this.appUrl}/invite/${raw}`,
      expiresAt: invite.expiresAt,
    });
  }

  private async assertCanAlterMember(
    orgId: string,
    callerUserId: string,
    membershipId: string,
    intendedRole?: Role,
  ): Promise<MembershipWithUser> {
    const target = await this.prisma.client.membership.findFirst({
      where: { id: membershipId, organizationId: orgId },
      include: { user: true },
    });
    if (!target) {
      throw new NotFoundException(TEAM_MESSAGES.member_not_found);
    }

    if (target.userId === callerUserId) {
      throw new BadRequestException(TEAM_MESSAGES.cannot_change_own_role);
    }

    const removesAdmin =
      target.role === 'ADMIN' &&
      target.status === 'ACTIVE' &&
      intendedRole !== 'ADMIN';

    if (removesAdmin) {
      const otherAdmins = await this.prisma.client.membership.count({
        where: {
          organizationId: orgId,
          role: 'ADMIN',
          status: 'ACTIVE',
          id: { not: membershipId },
        },
      });
      if (otherAdmins === 0) {
        throw new ConflictException(TEAM_MESSAGES.cannot_remove_last_admin);
      }
    }

    return target;
  }

  //  list Invitations

  async inviteMember(
    orgId: string,
    inviterUserId: string,
    input: InviteMemberInput,
  ): Promise<Invitation> {
    await this.prisma.client.invitation.updateMany({
      where: {
        organizationId: orgId,
        email: input.email,
        status: 'PENDING',
        expiresAt: { lte: new Date() },
      },
      data: { status: 'EXPIRED' },
    });

    // 1. Already an active member? Nothing to invite.
    const existing = await this.prisma.client.membership.findFirst({
      where: {
        organizationId: orgId,
        user: { email: input.email },
        status: 'ACTIVE',
      },
    });
    if (existing) {
      throw new ConflictException(TEAM_MESSAGES.already_member);
    }

    const pending = await this.prisma.client.invitation.findFirst({
      where: {
        organizationId: orgId,
        email: input.email,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });
    if (pending) {
      throw new ConflictException(TEAM_MESSAGES.already_invited);
    }

    // 3. Create. Only the hash is stored; the raw token lives in the email.
    const raw = randomToken();
    const invite = await this.prisma.client.invitation.create({
      data: {
        email: input.email,
        role: input.role,
        organizationId: orgId,
        status: 'PENDING',
        token: sha256(raw),
        invitedById: inviterUserId,
        expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000),
      },
      include: INVITE_CONTEXT,
    });

    // 4. Send. If the email can't go out, the invite must not exist either —
    //    otherwise the admin gets a 500 AND a PENDING row that 409s every retry.
    try {
      await this.sendInviteEmail(invite, raw); // awaited, or the catch below never fires
    } catch (e) {
      await this.prisma.client.invitation.delete({ where: { id: invite.id } });
      throw e;
    }

    return toInvitation(invite);
  }

  async listInvitations(
    orgId: string,
    includeInactive = false,
  ): Promise<Invitation[]> {
    const rows = await this.prisma.client.invitation.findMany({
      where: includeInactive
        ? { organizationId: orgId }
        : {
            organizationId: orgId,
            status: 'PENDING',
            expiresAt: { gt: new Date() },
          },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toInvitation);
  }

  // Revoke a pending invitation
  async revokeInvitation(orgId: string, id: string): Promise<void> {
    const invite = await this.prisma.client.invitation.findFirst({
      where: { id, organizationId: orgId, status: 'PENDING' },
      select: { id: true },
    });
    if (!invite) {
      throw new NotFoundException(TEAM_MESSAGES.invitation_invalid);
    }
    await this.prisma.client.invitation.update({
      where: { id: invite.id },
      data: { status: 'REVOKED' },
    });
  }

  // resend an invitation

  async resendInvitation(orgId: string, id: string): Promise<Invitation> {
    const existing = await this.prisma.client.invitation.findFirst({
      where: { id, organizationId: orgId, status: 'PENDING' },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(TEAM_MESSAGES.invitation_invalid);
    }

    const raw = randomToken();
    const invite = await this.prisma.client.invitation.update({
      where: { id: existing.id },
      data: {
        token: sha256(raw),
        expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000),
      },
      include: INVITE_CONTEXT,
    });

    await this.sendInviteEmail(invite, raw);

    return toInvitation(invite);
  }

  // update a member role
  async updateMemberRole(
    orgId: string,
    callerUserId: string,
    membershipId: string,
    role: Role,
  ): Promise<Member> {
    const member = await this.assertCanAlterMember(
      orgId,
      callerUserId,
      membershipId,
      role,
    );

    if (member.role === role) return toMember(member);

    const updated = await this.prisma.client.membership.update({
      where: { id: member.id },
      data: { role },
      include: { user: true },
    });

    await this.sessions.destroyAll(member.userId);

    return toMember(updated);
  }

  // remove a member
  async removeMember(
    orgId: string,
    callerUserId: string,
    membershipId: string,
  ): Promise<void> {
    const member = await this.assertCanAlterMember(
      orgId,
      callerUserId,
      membershipId,
    );

    if (member.status === 'SUSPENDED') return;

    const updated = await this.prisma.client.membership.update({
      where: { id: member.id },
      data: { status: 'SUSPENDED' },
      include: { organization: { select: { organizationName: true } } },
    });

    await this.sessions.destroyAll(member.userId);

    try {
      const remover = await this.prisma.client.user.findUnique({
        where: { id: callerUserId },
        select: { firstName: true, lastName: true, email: true },
      });
      await this.mail.sendMemberRemoved({
        memberEmail: member.user.email,
        organizationName: updated.organization.organizationName,
        removedByName: remover
          ? `${remover.firstName} ${remover.lastName}`.trim()
          : 'An organization admin',
        removedByEmail: remover?.email ?? '',
        previousRoleLabel: ROLE_LABEL[member.role] ?? member.role,
        removedAt: new Date(),
      });
    } catch (e) {
      this.logger.warn(`member-removed email failed: ${(e as Error).message}`);
    }
  }
}
