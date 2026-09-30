import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from 'db';
import type {
  EmailOnboardingInput,
  OAuthOnboardingInput,
  SessionUser,
} from 'shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { SessionService } from './session/session.service';
import { hashPassword } from '../../common/utils/password.util';
import { toSessionUser } from './auth.mapper';
import { REDIS_KEY } from '../../common/constants/constants.config';
import { SIGNUP_MESSAGES } from '../../common/constants/messages.config';
import type { PendingSignupRecord } from './auth.service';

type SignupResult = {
  user: SessionUser;
  tokens: { accessToken: string; refreshToken: string };
};

/** The bits of the User row that differ between signup paths. */
type UserSeed = Pick<
  Prisma.UserCreateInput,
  'passwordHashed' | 'authProcess' | 'githubAccountId' | 'googleAccountId'
>;

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly sessions: SessionService,
  ) {}

  /**
   * Route 3: POST /auth/onboarding (magic-link signups).
   * Only difference from OAuth: there's a password to hash and store.
   */
  async completeEmailSignup(
    pending: PendingSignupRecord,
    pendingId: string,
    input: EmailOnboardingInput,
  ): Promise<SignupResult> {
    // Hash BEFORE the transaction — bcrypt takes ~250ms and shouldn't hold a DB connection.
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
      // P2002 = unique constraint hit (User.email, Organization.organizationEmail,
      // or a provider account id). A signup for this identity already completed.
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
