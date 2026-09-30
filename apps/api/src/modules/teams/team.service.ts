import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from 'db';
import type { Invitation, InviteMemberInput, Member } from 'shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { TEAM_MESSAGES } from '../../common/constants/messages.config';
import { randomToken, sha256 } from '../../common/utils/token.util';
import {
  INVITATION_TTL_DAYS,
  ROLE_LABEL,
} from '../../common/constants/constants.config';

@Injectable()
export class TeamService {
  private readonly appUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
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

  //  list Invitations

  async inviteMember(
    orgId: string,
    inviterUserId: string,
    input: InviteMemberInput,
  ): Promise<Invitation> {
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
      include: {
        organization: { select: { organizationName: true } },
        invitedBy: { select: { firstName: true, lastName: true } },
      },
    });

    // 4. Send. If the email can't go out, the invite must not exist either —
    //    otherwise the admin gets a 500 AND a PENDING row that 409s every retry.
    try {
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
    } catch (e) {
      await this.prisma.client.invitation.delete({ where: { id: invite.id } });
      throw e;
    }

    return toInvitation(invite);
  }

  /** Pending, unexpired invitations for the org. */
  async listInvitations(orgId: string): Promise<Invitation[]> {
    const rows = await this.prisma.client.invitation.findMany({
      where: {
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
}

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
