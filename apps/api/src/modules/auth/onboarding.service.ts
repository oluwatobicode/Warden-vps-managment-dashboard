import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from 'db';
import type {
  AcceptInviteInput,
  DeclineInviteInput,
  EmailOnboardingInput,
  OAuthOnboardingInput,
  SessionUser,
} from 'shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { SessionService } from './session/session.service';
import { MailService } from '../../mail/mail.service';
import { hashPassword } from '../../common/utils/password.util';
import { sha256 } from '../../common/utils/token.util';
import { uniqueSlug } from '../../common/utils/slug.util';
import { toSessionUser } from './auth.mapper';
import { REDIS_KEY, ROLE_LABEL } from '../../common/constants/constants.config';
import {
  SIGNUP_MESSAGES,
  TEAM_MESSAGES,
} from '../../common/constants/messages.config';
import type { PendingSignupRecord } from './auth.service';

type SignupResult = {
  user: SessionUser;
  tokens: { accessToken: string; refreshToken: string };
};

type UserSeed = Pick<
  Prisma.UserCreateInput,
  'passwordHashed' | 'authProcess' | 'githubAccountId' | 'googleAccountId'
>;

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);
  private readonly appUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly sessions: SessionService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.appUrl = config.getOrThrow<string>('APP_URL');
  }

  // accept an invite
  async acceptInvite(input: AcceptInviteInput): Promise<SignupResult> {
    const invite = await this.prisma.client.invitation.findFirst({
      where: {
        token: sha256(input.token),
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      include: {
        organization: true,
        invitedBy: { select: { email: true } },
      },
    });
    if (!invite) {
      throw new UnauthorizedException(TEAM_MESSAGES.invitation_invalid);
    }

    const passwordHashed = await hashPassword(input.password);

    let created;
    try {
      created = await this.prisma.client.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({
          where: { email: invite.email },
          include: { memberships: true },
        });

        if (
          existing?.memberships.some(
            (m) =>
              m.status === 'ACTIVE' &&
              m.organizationId !== invite.organizationId,
          )
        ) {
          throw new ConflictException(TEAM_MESSAGES.already_in_another_org);
        }

        const user =
          existing ??
          (await tx.user.create({
            data: {
              email: invite.email,
              firstName: input.firstName,
              lastName: input.lastName,
              passwordHashed,
              authProcess: 'EMAIL',
            },
          }));

        const key = { userId: user.id, organizationId: invite.organizationId };
        const current = await tx.membership.findUnique({
          where: { userId_organizationId: key },
        });
        if (current?.status === 'ACTIVE') {
          throw new ConflictException(TEAM_MESSAGES.already_member);
        }
        const membership = current
          ? await tx.membership.update({
              where: { userId_organizationId: key },
              data: { status: 'ACTIVE', role: invite.role },
            })
          : await tx.membership.create({
              data: { ...key, role: invite.role, status: 'ACTIVE' },
            });

        await tx.invitation.update({
          where: { id: invite.id },
          data: { status: 'ACCEPTED' },
        });

        return { user, membership };
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(SIGNUP_MESSAGES.email_taken);
      }
      throw e;
    }

    const tokens = await this.sessions.create(
      created.user.id,
      invite.organizationId,
      created.membership.role,
    );

    if (invite.invitedBy?.email) {
      try {
        const teamSize = await this.prisma.client.membership.count({
          where: { organizationId: invite.organizationId, status: 'ACTIVE' },
        });
        await this.mail.sendInviteAccepted(invite.invitedBy.email, {
          memberName:
            `${created.user.firstName} ${created.user.lastName}`.trim(),
          memberEmail: created.user.email,
          organizationName: invite.organization.organizationName,
          roleLabel:
            ROLE_LABEL[created.membership.role] ?? created.membership.role,
          invitedAt: invite.createdAt,
          joinedAt: new Date(),
          teamSize,
          manageTeamUrl: `${this.appUrl}/settings/team`,
        });
      } catch (e) {
        this.logger.warn(
          `invite-accepted email failed: ${(e as Error).message}`,
        );
      }
    }

    return {
      user: toSessionUser(
        created.user,
        invite.organization,
        created.membership,
      ),
      tokens,
    };
  }

  // POST /auth/onboarding (magic-link signups)

  async completeEmailSignup(
    pending: PendingSignupRecord,
    pendingId: string,
    input: EmailOnboardingInput,
  ): Promise<SignupResult> {
    const passwordHashed = await hashPassword(input.password);

    return this.createAccount(pending, pendingId, input, {
      passwordHashed,
      authProcess: 'EMAIL',
    });
  }

  // Route 3b: POST /auth/onboarding/oauth (GitHub / Google signups).,No password; the provider's account id is what links future logins.

  async completeOAuthSignup(
    pending: PendingSignupRecord,
    pendingId: string,
    input: OAuthOnboardingInput,
  ): Promise<SignupResult> {
    return this.createAccount(pending, pendingId, input, {
      authProcess: pending.provider,
      ...(pending.provider === 'GITHUB' && {
        githubAccountId: pending.providerId,
      }),
      ...(pending.provider === 'GOOGLE' && {
        googleAccountId: pending.providerId,
      }),
    });
  }

  // create an account after accepting a special invite link
  /**
   * POST /auth/invitations/decline (public). The invitee says no: the row is
   * marked DECLINED so the admin sees "declined" rather than "never answered".
   * Nothing is created and no session is issued.
   */
  async declineInvite(input: DeclineInviteInput): Promise<void> {
    // Same lookup as accept — one answer for wrong, used, revoked, expired.
    const invite = await this.prisma.client.invitation.findFirst({
      where: {
        token: sha256(input.token),
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!invite) {
      throw new UnauthorizedException(TEAM_MESSAGES.invitation_invalid);
    }

    await this.prisma.client.invitation.update({
      where: { id: invite.id },
      data: { status: 'DECLINED' },
    });
    // TODO: notify the inviter once an invite-declined template exists.
  }

  private async createAccount(
    pending: PendingSignupRecord,
    pendingId: string,
    input: OAuthOnboardingInput,
    seed: UserSeed,
  ): Promise<SignupResult> {
    let created;
    try {
      created = await this.prisma.client.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: pending.email,
            firstName: input.firstName,
            lastName: input.lastName,
            ...seed,
          },
        });

        const organization = await tx.organization.create({
          data: {
            organizationName: input.organizationName,
            slug: uniqueSlug(input.organizationName), // required, unique; suffix avoids collisions
            organizationEmail: pending.email,
          },
        });

        const membership = await tx.membership.create({
          data: {
            userId: user.id,
            organizationId: organization.id,
            role: 'ADMIN',
            status: 'ACTIVE',
          },
        });

        return { user, organization, membership };
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(SIGNUP_MESSAGES.email_taken);
      }
      throw e;
    }

    await this.redis.del(REDIS_KEY.pendingSignup(pendingId));

    const tokens = await this.sessions.create(
      created.user.id,
      created.organization.id,
      created.membership.role,
    );

    const user = toSessionUser(
      created.user,
      created.organization,
      created.membership,
    );

    return { user, tokens };
  }
}
