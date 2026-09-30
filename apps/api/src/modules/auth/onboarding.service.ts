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

  /**
   * POST /auth/invitations/accept (public — the invitee has no session).
   * Onboarding's sibling: the org already exists and the role comes from the
   * invite, so there's no Organization row to create.
   */
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

        // Phase 1 is single-org: an account that is ACTIVE elsewhere can't join.
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

    // 4. Only after commit: log them in.
    const tokens = await this.sessions.create(
      created.user.id,
      invite.organizationId,
      created.membership.role,
    );

    // 5. Tell the inviter. Best-effort — the account exists whether or not
    //    this email goes out.
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

  /**
   * Route 3: POST /auth/onboarding (magic-link signups).
   * Only difference from OAuth: there's a password to hash and store.
   */
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

  /**
   * Route 3b: POST /auth/onboarding/oauth (GitHub / Google signups).
   * No password; the provider's account id is what links future logins.
   */
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

  /**
   * Shared core: User + Organization + Membership in one transaction, burn the
   * pending record, log them in, shape the response.
   */
  private async createAccount(
    pending: PendingSignupRecord,
    pendingId: string,
    input: OAuthOnboardingInput, // EmailOnboardingInput is a superset of this
    seed: UserSeed,
  ): Promise<SignupResult> {
    // 1. One transaction: all three rows or none. `tx` is the transactional client;
    //    using `this.prisma.client` inside here would escape the transaction.
    let created;
    try {
      created = await this.prisma.client.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: pending.email, // the VERIFIED email from Redis, never from the body
            firstName: input.firstName,
            lastName: input.lastName,
            ...seed,
          },
        });

        const organization = await tx.organization.create({
          data: {
            organizationName: input.organizationName,
            // Schema requires a unique org email; the form doesn't collect one,
            // so the creator's email stands in. (Open question flagged earlier.)
            organizationEmail: pending.email,
          },
        });

        // The creator is ADMIN — otherwise nobody can manage the org.
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

    // 2. Only now that the rows exist do we burn the pending record.
    await this.redis.del(REDIS_KEY.pendingSignup(pendingId));

    // 3. Same login path as everything else.
    const tokens = await this.sessions.create(
      created.user.id,
      created.organization.id,
      created.membership.role,
    );

    // 4. Shape the response explicitly — never hand a Prisma User to a controller.
    const user = toSessionUser(
      created.user,
      created.organization,
      created.membership,
    );

    return { user, tokens };
  }
}
